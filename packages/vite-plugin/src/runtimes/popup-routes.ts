import type { Route } from "../routes.js";

interface GeneratePopupRoutesModuleOptions {
  routes: Route[];
}

/**
 * @file runtimes/popup-routes.ts
 * @description Generates the popup routes module.
 */
export function generatePopupRoutesModule({
  routes,
}: GeneratePopupRoutesModuleOptions) {
  const imports = routes
    .map((r) => `"${r.path}": () => import(${JSON.stringify(r.file)})`)
    .join(",\n");

  return `
export const routes = {
${imports}
}
`;
}
