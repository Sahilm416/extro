import fg from "fast-glob";
import path from "node:path";

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
 * Scans `src/` for popup routes (excluding `src/ext/**`).
 *
 * File-system conventions:
 *   src/page.tsx              → { type: "static",  path: "/" }
 *   src/settings/page.tsx     → { type: "static",  path: "/settings" }
 *   src/user/[id]/page.tsx    → { type: "dynamic", path: "/user/:id", paramKeys: ["id"] }
 *   src/[a]/[b]/page.tsx      → { type: "dynamic", path: "/:a/:b",   paramKeys: ["a", "b"] }
 *
 * Routes are sorted so static routes always come before dynamic ones,
 * ensuring exact matches are never shadowed by a dynamic pattern.
 */
export async function findPopupRoutes(root: string): Promise<Route[]> {
  const files = await fg("src/**/page.{ts,tsx}", {
    cwd: root,
    ignore: ["src/ext/**"],
  });

  const routes = files.map((file) => buildRoute(root, file));

  return sortRoutes(routes);
}

// ---------------------------------------------------------------------------
// Route builder
// ---------------------------------------------------------------------------

function buildRoute(root: string, relativeFile: string): Route {
  const segments = extractSegments(relativeFile);
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
 * Strips `src/` and the trailing `/page` filename to return only the
 * meaningful URL segments.
 *
 * "src/user/[id]/page.tsx" → ["user", "[id]"]
 * "src/page.tsx"           → []
 */
function extractSegments(relativeFile: string): string[] {
  const withoutExt = relativeFile.replace(/\.(tsx?)$/, "");
  return withoutExt.split("/").slice(1, -1); // drop "src" and "page"
}

/** Returns true for dynamic segments like `[id]` or `[userId]`. */
function isDynamic(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

/** Escapes special RegExp characters in a static path segment. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
