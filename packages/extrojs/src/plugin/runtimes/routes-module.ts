import type { ManifestRoute, RouteManifest } from "../../types/index.js";

/**
 * @file runtimes/routes-module.ts
 * @description The single codegen for the `virtual:extro/routes/<surface>`
 * Runtime module (ADR 0005). It is the only code that knows the text form of
 * the routing contract: lazy `import()` thunks, the dynamic-route RegExp, and
 * the `notFound` / `rootLayout` exports. Input is the typed `RouteManifest`;
 * output is asserted against the runtime `Route[]` type by the round-trip
 * test, so this string can no longer drift from what the runtime expects.
 *
 * Example output:
 *
 *   export const routes = [
 *     { type: "static",  path: "/",         boundaries: [...], load: () => import("...") },
 *     { type: "dynamic", path: "/user/:id", paramKeys: ["id"], pattern: new RegExp("^/user/([^/]+)$"), boundaries: [...], load: () => import("...") },
 *   ];
 *   export const notFound = () => import("...");
 *   export const rootLayout = null;
 */
export function emit(manifest: RouteManifest): string {
  const entries = manifest.routes.map(serializeRoute).join(",\n");

  return `export const routes = [
${entries}
];
export const notFound = ${loaderOrNull(manifest.notFound)};
export const rootLayout = ${loaderOrNull(manifest.rootLayout)};
`;
}

// ---------------------------------------------------------------------------
// Serialisers
// ---------------------------------------------------------------------------

/** A lazy import of an absolute path, or the `null` literal when absent. */
function loaderOrNull(file: string | null): string {
  return file ? `() => import(${JSON.stringify(file)})` : "null";
}

// Boundary chain is emitted outermost first as tagged lazy imports, so the
// runtime composes the route's wrappers without a separate tree fetch.
function serializeBoundaries(route: ManifestRoute): string {
  const entries = route.boundaries
    .map(
      (b) =>
        `{ kind: ${JSON.stringify(b.kind)}, load: () => import(${JSON.stringify(b.file)}) }`,
    )
    .join(", ");
  return `[${entries}]`;
}

function serializeRoute(route: ManifestRoute): string {
  if (route.type === "static") {
    return `  { type: "static", path: ${JSON.stringify(route.path)}, boundaries: ${serializeBoundaries(route)}, load: () => import(${JSON.stringify(route.file)}) }`;
  }

  // `patternSource` is materialized into a real RegExp here (the runtime
  // `Route` type carries `pattern: RegExp`); JSON.stringify keeps escaping
  // correct without RegExp-literal pitfalls.
  return `  { type: "dynamic", path: ${JSON.stringify(route.path)}, paramKeys: ${JSON.stringify(route.paramKeys)}, pattern: new RegExp(${JSON.stringify(route.patternSource)}), boundaries: ${serializeBoundaries(route)}, load: () => import(${JSON.stringify(route.file)}) }`;
}
