import fg from "fast-glob";
import path from "node:path";
import type {
  RouteShape,
  StaticRouteShape,
  DynamicRouteShape,
} from "@extro/types";
import {
  findSurface,
  type RoutableSurface,
  type ScriptSurface,
} from "./surfaces.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Build-side leaf: the absolute path to the page source file. */
type BuildLeaf = { file: string };

export type StaticRoute = StaticRouteShape<BuildLeaf>;
export type DynamicRoute = DynamicRouteShape<BuildLeaf>;
export type Route = RouteShape<BuildLeaf>;

export type AppTree = {
  scripts: Partial<Record<ScriptSurface, string>>;
  surfaces: Partial<Record<RoutableSurface, Route[]>>;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Single pass over `src/app/`. Every convention of the app tree lives here:
 *
 *   - Routable surfaces use `page.{ts,tsx}` and may nest. `[id]` segments
 *     become dynamic params.
 *       src/app/popup/page.tsx              → { type: "static",  path: "/" }
 *       src/app/popup/settings/page.tsx     → { type: "static",  path: "/settings" }
 *       src/app/popup/user/[id]/page.tsx    → { type: "dynamic", path: "/user/:id" }
 *
 *   - Script surfaces use `index.{ts,tsx}` at the surface root and do not
 *     nest.
 *
 * Which surfaces fall into which kind is declared in `surfaces.ts`; this
 * dispatcher consults `findSurface(name).kind` rather than hard-coding names.
 *
 * An empty result is returned as-is — the caller decides whether that's an
 * error.
 */
export async function scanAppTree(root: string): Promise<AppTree> {
  const files = await fg("src/app/**/{page,index}.{ts,tsx}", { cwd: root });

  const scripts: AppTree["scripts"] = {};
  const routesBySurface = new Map<RoutableSurface, Route[]>();

  for (const file of files) {
    const parts = file.split("/").slice(2); // drop "src/app/"
    const surface = parts[0];
    if (!surface) continue;

    const desc = findSurface(surface);
    if (!desc) continue;

    const filename = parts[parts.length - 1];
    const isPage = /^page\.tsx?$/.test(filename);
    const isIndex = /^index\.tsx?$/.test(filename);

    if (desc.kind === "script") {
      // Script entries are index.{ts,tsx} at the surface root only.
      if (!isIndex || parts.length !== 2) continue;
      scripts[surface as ScriptSurface] = path.join(root, file);
      continue;
    }

    if (desc.kind === "routable" && isPage) {
      const segments = parts.slice(1, -1); // drop surface dir + "page.{ext}"
      const route = buildRoute(path.join(root, file), segments);
      const name = surface as RoutableSurface;
      const list = routesBySurface.get(name) ?? [];
      list.push(route);
      routesBySurface.set(name, list);
    }
  }

  const surfaces: AppTree["surfaces"] = {};
  for (const [name, routes] of routesBySurface) {
    surfaces[name] = sortRoutes(routes);
  }

  return { scripts, surfaces };
}

// ---------------------------------------------------------------------------
// Route builder
// ---------------------------------------------------------------------------

function buildRoute(file: string, segments: string[]): Route {
  if (segments.some(isDynamic)) return buildDynamicRoute(file, segments);
  return buildStaticRoute(file, segments);
}

function buildStaticRoute(file: string, segments: string[]): StaticRoute {
  const urlPath = segments.length > 0 ? `/${segments.join("/")}` : "/";
  return { type: "static", path: urlPath, file };
}

function buildDynamicRoute(file: string, segments: string[]): DynamicRoute {
  const paramKeys: string[] = [];

  const patternParts = segments.map((seg) => {
    if (isDynamic(seg)) {
      paramKeys.push(seg.slice(1, -1)); // strip [ and ]
      return "([^/]+)";
    }
    return escapeRegex(seg);
  });

  const pattern = new RegExp(`^/${patternParts.join("/")}$`);
  const urlPath = segments
    .map((seg) => (isDynamic(seg) ? `:${seg.slice(1, -1)}` : seg))
    .join("/");

  return { type: "dynamic", path: `/${urlPath}`, file, paramKeys, pattern };
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Static routes first (longest first for specificity), then dynamic routes
 * (longest first so /user/:id beats /:anything for the same depth).
 *
 * Alphabetical tiebreak keeps the output stable across filesystems — otherwise
 * two routes of equal length would sort by readdir order, which varies.
 */
function sortRoutes(routes: Route[]): Route[] {
  const byLengthThenAlpha = (a: Route, b: Route) =>
    b.path.length - a.path.length || a.path.localeCompare(b.path);

  const statics = routes
    .filter((r): r is StaticRoute => r.type === "static")
    .sort(byLengthThenAlpha);

  const dynamics = routes
    .filter((r): r is DynamicRoute => r.type === "dynamic")
    .sort(byLengthThenAlpha);

  return [...statics, ...dynamics];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true for dynamic segments like `[id]` or `[userId]`. */
function isDynamic(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

/** Escapes special RegExp characters in a static path segment. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
