import fg from "fast-glob";
import path from "node:path";
import type {
  RouteShape,
  StaticRouteShape,
  DynamicRouteShape,
} from "@extrojs/types";
import { findSurface, type RoutableSurface } from "./surfaces.js";

/**
 * Basenames the scanner recognizes under `src/app/`. The dev watcher in
 * `index.ts` derives its glob + match regex from this same list so dev
 * structural-change detection can never drift from what the scanner reads.
 * (Guard: #9 widened the scanner to include `layout` but not the watcher,
 * which silently broke layout HMR. Append `not-found` here when #10 lands.)
 */
export const APP_FILE_BASENAMES = [
  "page",
  "index",
  "layout",
  "error",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoundaryKind = "layout" | "error";

/** One ancestor wrapper for a route: a `layout.tsx` or an `error.tsx`. */
type BuildBoundary = { kind: BoundaryKind; file: string };

/**
 * Build-side leaf: the page source path plus its ancestor boundary chain,
 * outermost first, resolved once here so the runtime never walks a tree.
 * Within a segment the layout precedes the error, so composing the chain
 * inside-out yields `<L_i><E_i> ... </E_i></L_i>` per ADR 0003 §3 (an
 * `error.tsx` is nested inside its own sibling `layout.tsx`).
 */
type BuildLeaf = { file: string; boundaries: BuildBoundary[] };

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
  const files = await fg(
    `src/app/**/{${APP_FILE_BASENAMES.join(",")}}.{ts,tsx}`,
    { cwd: root },
  );

  const scripts: AppTree["scripts"] = {};
  const pagesBySurface = new Map<
    RoutableSurface,
    { file: string; segments: string[] }[]
  >();
  // surface → (segment key, e.g. "" or "settings" or "c/[id]") → file path.
  const layoutsBySurface = new Map<RoutableSurface, Map<string, string>>();
  const errorsBySurface = new Map<RoutableSurface, Map<string, string>>();

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
    const isError = /^error\.tsx?$/.test(filename);

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
    } else if (isLayout || isError) {
      const bySurface = isLayout ? layoutsBySurface : errorsBySurface;
      const map = bySurface.get(name) ?? new Map<string, string>();
      map.set(segments.join("/"), path.join(root, file));
      bySurface.set(name, map);
    }
  }

  const surfaces: AppTree["surfaces"] = {};
  for (const [name, pages] of pagesBySurface) {
    const layoutMap = layoutsBySurface.get(name);
    const errorMap = errorsBySurface.get(name);
    const routes = pages.map(({ file, segments }) =>
      buildRoute(
        file,
        segments,
        resolveBoundaryChain(segments, layoutMap, errorMap),
      ),
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
  boundaries: BuildBoundary[],
): Route {
  if (segments.some(isDynamic))
    return buildDynamicRoute(file, segments, boundaries);
  return buildStaticRoute(file, segments, boundaries);
}

function buildStaticRoute(
  file: string,
  segments: string[],
  boundaries: BuildBoundary[],
): StaticRoute {
  const urlPath = segments.length > 0 ? `/${segments.join("/")}` : "/";
  return { type: "static", path: urlPath, file, boundaries };
}

function buildDynamicRoute(
  file: string,
  segments: string[],
  boundaries: BuildBoundary[],
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
    boundaries,
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
 * Ancestor boundary chain for a page, outermost first: walk from the
 * surface-root segment (key "") down to the page's own segment. At each
 * depth the `layout.tsx` is pushed before the `error.tsx`, so composing the
 * chain inside-out nests the error within its sibling layout (ADR 0003 §3).
 * Only the files that exist are included.
 */
function resolveBoundaryChain(
  segments: string[],
  layoutMap: Map<string, string> | undefined,
  errorMap: Map<string, string> | undefined,
): BuildBoundary[] {
  const chain: BuildBoundary[] = [];
  for (let i = 0; i <= segments.length; i++) {
    const key = segments.slice(0, i).join("/");
    const layout = layoutMap?.get(key);
    if (layout) chain.push({ kind: "layout", file: layout });
    const error = errorMap?.get(key);
    if (error) chain.push({ kind: "error", file: error });
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
