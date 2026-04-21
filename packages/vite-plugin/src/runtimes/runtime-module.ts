import type { RoutableSurface } from "../constants.js";

interface GenerateRuntimeModuleOptions {
  surface: RoutableSurface;
}

/**
 * @file runtimes/runtime-module.ts
 * @description Generates the surface runtime module.
 *
 * Route matching priority (enforced by the order of the `routes` array):
 *   1. Static routes  — exact path match
 *   2. Dynamic routes — regex match, params extracted into an object
 *
 * Every page component always receives `{ params }`:
 *   - Static routes:  params = {}
 *   - Dynamic routes: params = { id: "42" } (keyed by segment name)
 *
 * Navigation (hash-based, works in every extension surface context):
 *   <a href="#/user/42">Profile</a>
 *   window.location.hash = "#/user/42";
 */
export function generateRuntimeModule({
  surface,
}: GenerateRuntimeModuleOptions): string {
  return `import React from "react";
import { createRoot } from "react-dom/client";
import { routes } from "virtual:extro/routes/${surface}";

const el = document.getElementById("root");

if (!el) {
  throw new Error("Extro: #root element not found");
}

const root = createRoot(el);

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

function getCurrentPath() {
  return window.location.hash.replace(/^#/, "") || "/";
}

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

/**
 * Finds the first matching route for the given path and returns it alongside
 * the extracted params object.
 *
 * Walks the routes array in order — static routes are listed first by the
 * plugin, so exact matches always win over dynamic patterns.
 *
 * @returns { route, params } or null if nothing matched.
 */
function matchRoute(path) {
  for (const route of routes) {
    if (route.type === "static") {
      if (route.path === path) return { route, params: {} };
      continue;
    }

    // Dynamic route — test the pre-compiled regex.
    const match = path.match(route.pattern);
    if (!match) continue;

    // Map each capture group to its param name positionally.
    const params = Object.fromEntries(
      route.paramKeys.map((key, i) => [key, match[i + 1]])
    );

    return { route, params };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

async function render() {
  const path    = getCurrentPath();
  const matched = matchRoute(path);

  if (!matched) {
    console.error("Extro: no route matched for ${surface}", path);
    return;
  }

  const { route, params } = matched;
  const mod               = await route.load();
  const Component         = mod.default;

  root.render(React.createElement(Component, { params }));
}

window.addEventListener("hashchange", render);

render();
`;
}
