import fg from "fast-glob";
import path from "node:path";
import type {
  ManifestRoute,
  ManifestBoundary,
  RouteManifest,
} from "../types/index.js";
import { findSurface, type RoutableSurface } from "./surfaces.js";

type StaticManifestRoute = Extract<ManifestRoute, { type: "static" }>;
type DynamicManifestRoute = Extract<ManifestRoute, { type: "dynamic" }>;

/**
 * Basenames the scanner recognizes under `src/app/`. The dev watcher in
 * `index.ts` derives its glob + match regex from this same list so dev
 * structural-change detection can never drift from what the scanner reads.
 * (Guard: #9 widened the scanner to include `layout` but not the watcher,
 * which silently broke layout HMR. This list is the single source so it
 * cannot recur.)
 */
export const APP_FILE_BASENAMES = [
  "page",
  "index",
  "layout",
  "error",
  "not-found",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// The Route shape is owned by `@extrojs/types` (the Route manifest, ADR
// 0005). The scanner produces `ManifestRoute` directly: serializable, with
// `patternSource` rather than a live RegExp.

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
  /**
   * Each present Routable surface's slot _is_ its `RouteManifest` (ADR 0007):
   * routes + the per-surface not-found / surface-root layout in one record,
   * so the pieces cannot desync. Present iff the surface has >= 1 page.
   */
  surfaces: Partial<Record<RoutableSurface, RouteManifest>>;
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
  const notFoundBySurface = new Map<RoutableSurface, string>();

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
    const isNotFound = /^not-found\.tsx?$/.test(filename);

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
    } else if (isNotFound && segments.length === 0) {
      // ADR 0003 §4: only the surface-root not-found.tsx is recognized;
      // deeper ones are intentionally ignored in v0.
      notFoundBySurface.set(name, path.join(root, file));
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
    // One RouteManifest per surface: routes + not-found + root layout in a
    // single record, so the pieces cannot desync (ADR 0007).
    surfaces[name] = {
      routes: sortRoutes(routes),
      notFound: notFoundBySurface.get(name) ?? null,
      rootLayout: layoutMap?.get("") ?? null,
    };
  }

  return { scripts, surfaces };
}

const EMPTY_MANIFEST: RouteManifest = {
  routes: [],
  notFound: null,
  rootLayout: null,
};

/**
 * Accessor for one Routable surface's `RouteManifest` — its slot of the
 * AppTree, or an empty manifest when the surface is absent (ADR 0005/0007).
 * The single input to `emit` and the invalidation key, and the fixture seam
 * for the round-trip test (build one by hand, no filesystem scan needed).
 */
export function routeManifest(
  tree: AppTree,
  surface: RoutableSurface,
): RouteManifest {
  return tree.surfaces[surface] ?? EMPTY_MANIFEST;
}

// ---------------------------------------------------------------------------
// Route builder
// ---------------------------------------------------------------------------

function buildRoute(
  file: string,
  segments: string[],
  boundaries: ManifestBoundary[],
): ManifestRoute {
  if (segments.some(isDynamic))
    return buildDynamicRoute(file, segments, boundaries);
  return buildStaticRoute(file, segments, boundaries);
}

function buildStaticRoute(
  file: string,
  segments: string[],
  boundaries: ManifestBoundary[],
): StaticManifestRoute {
  const urlPath = segments.length > 0 ? `/${segments.join("/")}` : "/";
  return { type: "static", path: urlPath, file, boundaries };
}

function buildDynamicRoute(
  file: string,
  segments: string[],
  boundaries: ManifestBoundary[],
): DynamicManifestRoute {
  const paramKeys: string[] = [];

  const patternParts = segments.map((seg) => {
    if (isDynamic(seg)) {
      paramKeys.push(seg.slice(1, -1)); // strip [ and ]
      return "([^/]+)";
    }
    return escapeRegex(seg);
  });

  // Serializable: the RegExp body, materialized by `emit` at codegen time.
  const patternSource = `^/${patternParts.join("/")}$`;
  const urlPath = segments
    .map((seg) => (isDynamic(seg) ? `:${seg.slice(1, -1)}` : seg))
    .join("/");

  return {
    type: "dynamic",
    path: `/${urlPath}`,
    file,
    paramKeys,
    patternSource,
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
function sortRoutes(routes: ManifestRoute[]): ManifestRoute[] {
  const byLengthThenAlpha = (a: ManifestRoute, b: ManifestRoute) =>
    b.path.length - a.path.length || a.path.localeCompare(b.path);

  const statics = routes
    .filter((r): r is StaticManifestRoute => r.type === "static")
    .sort(byLengthThenAlpha);

  const dynamics = routes
    .filter((r): r is DynamicManifestRoute => r.type === "dynamic")
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
): ManifestBoundary[] {
  const chain: ManifestBoundary[] = [];
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
