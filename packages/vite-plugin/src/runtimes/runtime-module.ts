import type { RoutableSurface } from "../constants.js";

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

createExtroRouter(routes, { surface: ${JSON.stringify(surface)} });
`;
}
