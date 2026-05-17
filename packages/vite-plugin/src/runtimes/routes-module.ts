import type { Route } from "../app-tree.js";

interface GenerateRoutesModuleOptions {
  routes: Route[];
}

/**
 * @file runtimes/routes-module.ts
 * @description Generates the virtual routes module for a given surface.
 *
 * Outputs an array (not an object map) because dynamic routes need runtime
 * regex matching — a flat ordered array handles both static and dynamic
 * routes uniformly, and preserves the priority order from `findSurfaceRoutes`
 * (static routes always appear before dynamic ones).
 *
 * Example output:
 *
 *   export const routes = [
 *     { type: "static",  path: "/",         load: () => import("...") },
 *     { type: "static",  path: "/settings", load: () => import("...") },
 *     { type: "dynamic", path: "/user/:id", paramKeys: ["id"], pattern: /^\/user\/([^/]+)$/, load: () => import("...") },
 *   ];
 */
export function generateRoutesModule({
  routes,
}: GenerateRoutesModuleOptions): string {
  const entries = routes.map(serializeRoute).join(",\n");

  return `export const routes = [
${entries}
];
`;
}

// ---------------------------------------------------------------------------
// Serialisers
// ---------------------------------------------------------------------------

// Boundary chain is emitted outermost first as tagged lazy imports, so the
// runtime composes the route's wrappers without a separate tree fetch.
function serializeBoundaries(route: Route): string {
  const entries = route.boundaries
    .map(
      (b) =>
        `{ kind: ${JSON.stringify(b.kind)}, load: () => import(${JSON.stringify(b.file)}) }`,
    )
    .join(", ");
  return `[${entries}]`;
}

function serializeRoute(route: Route): string {
  if (route.type === "static") {
    return `  { type: "static", path: ${JSON.stringify(route.path)}, boundaries: ${serializeBoundaries(route)}, load: () => import(${JSON.stringify(route.file)}) }`;
  }

  // RegExp is written as a literal (not a string) so it's a real RegExp in
  // the generated bundle and the runtime can call .exec() on it directly.
  return `  { type: "dynamic", path: ${JSON.stringify(route.path)}, paramKeys: ${JSON.stringify(route.paramKeys)}, pattern: ${route.pattern.toString()}, boundaries: ${serializeBoundaries(route)}, load: () => import(${JSON.stringify(route.file)}) }`;
}
