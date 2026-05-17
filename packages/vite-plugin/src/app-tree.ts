import fg from "fast-glob";
import path from "node:path";
import type {
  RouteShape,
  StaticRouteShape,
  DynamicRouteShape,
} from "@extrojs/types";
import { findSurface, type RoutableSurface } from "./surfaces.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Build-side leaf: the page source path plus its ancestor layout chain
 * (outermost first), resolved once here so the runtime never walks a tree.
 */
type BuildLeaf = { file: string; layouts: string[] };

export type StaticRoute = StaticRouteShape<BuildLeaf>;
export type DynamicRoute = DynamicRouteShape<BuildLeaf>;
export type Route = RouteShape<BuildLeaf>;

/**
 * The Content surface has up to two Modes: a raw script entry
 * (`src/app/content/index.{ts,tsx}`) and a CSUI page (`src/app/content/page.tsx`).
 * At least one is set when the slot exists; both may be set together.
 * Stage 3 turns `csui` into a `Route[]`.
 */
export type ContentSlot = { script?: string; csui?: string };

export type AppTree = {
  scripts: {
    background?: string;
    content?: ContentSlot;
  };
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
  const files = await fg("src/app/**/{page,index,layout}.{ts,tsx}", {
    cwd: root,
  });

  const scripts: AppTree["scripts"] = {};
  const pagesBySurface = new Map<
    RoutableSurface,
    { file: string; segments: string[] }[]
  >();
  // surface → (segment key, e.g. "" or "settings" or "c/[id]") → layout path.
  const layoutsBySurface = new Map<RoutableSurface, Map<string, string>>();

  for (const file of files) {
    const parts = file.split("/").slice(2); // drop "src/app/"
    const surface = parts[0];
    if (!surface) continue;

    const desc = findSurface(surface);
    if (!desc) continue;

    const filename = parts[parts.length - 1];
    const isPage = /^page\.tsx?$/.test(filename);
    const isIndex = /^index\.tsx?$/.test(filename);
    const isLayout = /^layout\.tsx?$/.test(filename);

    if (desc.kind === "script") {
      if (parts.length !== 2) continue;
      if (!isIndex && !(isPage && desc.acceptsCsuiPage)) continue;

      const abs = path.join(root, file);
      if (surface === "background") {
        scripts.background = abs;
      } else if (surface === "content") {
        scripts.content = {
          ...scripts.content,
          [isIndex ? "script" : "csui"]: abs,
        };
      }
      continue;
    }

    if (desc.kind !== "routable") continue;

    const name = surface as RoutableSurface;
    const segments = parts.slice(1, -1); // drop surface dir + filename

    if (isPage) {
      const list = pagesBySurface.get(name) ?? [];
      list.push({ file: path.join(root, file), segments });
      pagesBySurface.set(name, list);
    } else if (isLayout) {
      const map = layoutsBySurface.get(name) ?? new Map<string, string>();
      map.set(segments.join("/"), path.join(root, file));
      layoutsBySurface.set(name, map);
    }
  }

  const surfaces: AppTree["surfaces"] = {};
  for (const [name, pages] of pagesBySurface) {
    const layoutMap = layoutsBySurface.get(name);
    const routes = pages.map(({ file, segments }) =>
      buildRoute(file, segments, resolveLayoutChain(segments, layoutMap)),
    );
    surfaces[name] = sortRoutes(routes);
  }

  return { scripts, surfaces };
}

// ---------------------------------------------------------------------------
// Route builder
// ---------------------------------------------------------------------------

function buildRoute(
  file: string,
  segments: string[],
  layouts: string[],
): Route {
  if (segments.some(isDynamic))
    return buildDynamicRoute(file, segments, layouts);
  return buildStaticRoute(file, segments, layouts);
}

function buildStaticRoute(
  file: string,
  segments: string[],
  layouts: string[],
): StaticRoute {
  const urlPath = segments.length > 0 ? `/${segments.join("/")}` : "/";
  return { type: "static", path: urlPath, file, layouts };
}

function buildDynamicRoute(
  file: string,
  segments: string[],
  layouts: string[],
): DynamicRoute {
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

  return {
    type: "dynamic",
    path: `/${urlPath}`,
    file,
    paramKeys,
    pattern,
    layouts,
  };
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

/**
 * Ancestor layouts for a page, outermost first: the surface-root `layout.tsx`
 * (segment key "") down to a `layout.tsx` co-located with the page. Only the
 * ones that exist are returned.
 */
function resolveLayoutChain(
  segments: string[],
  layoutMap: Map<string, string> | undefined,
): string[] {
  if (!layoutMap) return [];

  const chain: string[] = [];
  for (let i = 0; i <= segments.length; i++) {
    const file = layoutMap.get(segments.slice(0, i).join("/"));
    if (file) chain.push(file);
  }
  return chain;
}

/** Returns true for dynamic segments like `[id]` or `[userId]`. */
function isDynamic(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

/** Escapes special RegExp characters in a static path segment. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
