import fg from "fast-glob";
import path from "node:path";
import type { RoutableSurface } from "./constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StaticRoute = {
  type: "static";
  path: string;
  file: string;
};

export type DynamicRoute = {
  type: "dynamic";
  /** Human-readable pattern, e.g. "/user/:id". Used for logging. */
  path: string;
  file: string;
  /** Ordered param names matching the regex capture groups, e.g. ["id"]. */
  paramKeys: string[];
  /**
   * Pre-compiled RegExp that matches the URL and captures param values.
   * Capture groups correspond positionally to `paramKeys`.
   *
   * e.g. /^\/user\/([^/]+)$/ for "/user/[id]"
   */
  pattern: RegExp;
};

export type Route = StaticRoute | DynamicRoute;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scans `src/app/<surface>/**` for routes.
 *
 * File-system conventions (for e.g. surface = "popup"):
 *   src/app/popup/page.tsx              → { type: "static",  path: "/" }
 *   src/app/popup/settings/page.tsx     → { type: "static",  path: "/settings" }
 *   src/app/popup/user/[id]/page.tsx    → { type: "dynamic", path: "/user/:id", paramKeys: ["id"] }
 *   src/app/popup/[a]/[b]/page.tsx      → { type: "dynamic", path: "/:a/:b",   paramKeys: ["a", "b"] }
 *
 * Routes are sorted so static routes always come before dynamic ones,
 * ensuring exact matches are never shadowed by a dynamic pattern.
 */
export async function findSurfaceRoutes({
  root,
  surface,
}: {
  root: string;
  surface: RoutableSurface;
}): Promise<Route[]> {
  const base = `src/app/${surface}`;

  const files = await fg(`${base}/**/page.{ts,tsx}`, { cwd: root });

  const routes = files.map((file) => buildRoute(root, file, base));

  return sortRoutes(routes);
}

// ---------------------------------------------------------------------------
// Route builder
// ---------------------------------------------------------------------------

function buildRoute(root: string, relativeFile: string, base: string): Route {
  const segments = extractSegments(relativeFile, base);
  const absFile = path.join(root, relativeFile);

  if (segments.some(isDynamic)) {
    return buildDynamicRoute(absFile, segments);
  }

  return buildStaticRoute(absFile, segments);
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
 */
function sortRoutes(routes: Route[]): Route[] {
  const statics = routes
    .filter((r): r is StaticRoute => r.type === "static")
    .sort((a, b) => b.path.length - a.path.length);

  const dynamics = routes
    .filter((r): r is DynamicRoute => r.type === "dynamic")
    .sort((a, b) => b.path.length - a.path.length);

  return [...statics, ...dynamics];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips the surface base path and the trailing `/page` filename to return
 * only the meaningful URL segments.
 *
 * base = "src/app/popup"
 *   "src/app/popup/user/[id]/page.tsx" → ["user", "[id]"]
 *   "src/app/popup/page.tsx"           → []
 */
function extractSegments(relativeFile: string, base: string): string[] {
  const withoutBase = relativeFile.slice(base.length + 1); // drop "src/app/popup/"
  const withoutExt = withoutBase.replace(/\.(tsx?)$/, "");
  const parts = withoutExt.split("/");
  return parts.slice(0, -1); // drop "page"
}

/** Returns true for dynamic segments like `[id]` or `[userId]`. */
function isDynamic(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

/** Escapes special RegExp characters in a static path segment. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
