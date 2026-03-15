import type { Route } from "../routes.js";

interface GeneratePopupRoutesModuleOptions {
  routes: Route[];
}

/**
 * @file runtimes/popup-routes.ts
 * @description Generates the popup routes virtual module.
 *
 * Outputs an array (not an object map) because dynamic routes need runtime
 * regex matching — a flat ordered array handles both static and dynamic
 * routes uniformly, and preserves the priority order from `findPopupRoutes`
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
export function generatePopupRoutesModule({
  routes,
}: GeneratePopupRoutesModuleOptions): string {
  const entries = routes.map(serializeRoute).join(",\n");

  return `export const routes = [
${entries}
];
`;
}

// ---------------------------------------------------------------------------
// Serialisers
// ---------------------------------------------------------------------------

function serializeRoute(route: Route): string {
  if (route.type === "static") {
    return `  { type: "static", path: ${JSON.stringify(route.path)}, load: () => import(${JSON.stringify(route.file)}) }`;
  }

  // RegExp is written as a literal (not a string) so it's a real RegExp in
  // the generated bundle and the runtime can call .exec() on it directly.
  return `  { type: "dynamic", path: ${JSON.stringify(route.path)}, paramKeys: ${JSON.stringify(route.paramKeys)}, pattern: ${route.pattern.toString()}, load: () => import(${JSON.stringify(route.file)}) }`;
}