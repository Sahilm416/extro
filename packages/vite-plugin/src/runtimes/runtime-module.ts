import type { RoutableSurface } from "../surfaces.js";

interface GenerateRuntimeModuleOptions {
  surface: RoutableSurface;
}

/**
 * @file runtimes/runtime-module.ts
 * @description Generates the per-surface runtime entry.
 *
 * The real runtime logic (mounting, route matching, render loop) lives in
 * `@extro/react/router` as actual TypeScript — this file only emits a tiny
 * shim that wires the compiled routes array into `createExtroRouter`.
 */
export function generateRuntimeModule({
  surface,
}: GenerateRuntimeModuleOptions): string {
  return `import { createExtroRouter } from "@extro/react/router";
import { routes } from "virtual:extro/routes/${surface}";

// Persist the router handle across HMR updates so we never call createRoot twice.
// import.meta.hot.data survives module re-execution.
let handle = import.meta.hot?.data?.handle;

if (!handle) {
  handle = createExtroRouter(routes, { surface: ${JSON.stringify(surface)} });
  if (import.meta.hot) {
    import.meta.hot.data.handle = handle;
  }
} else {
  handle.update(routes);
}

if (import.meta.hot) {
  import.meta.hot.accept("virtual:extro/routes/${surface}", (mod) => {
    if (mod?.routes) {
      handle.update(mod.routes);
    }
  });

  import.meta.hot.accept();
}
`;
}
