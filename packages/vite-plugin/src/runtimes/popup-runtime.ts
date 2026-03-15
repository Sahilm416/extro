/**
 * @file runtimes/popup-runtime.ts
 * @description Generates the popup runtime module.
 */
export function generatePopupRuntimeModule() {
  return `import React from "react";
import { createRoot } from "react-dom/client";
import { routes } from "virtual:extro-popup-routes";

const el = document.getElementById("root");

if (!el) {
  throw new Error("Extro: #root element not found");
}

function getCurrentRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/";
}

const root = createRoot(el);

async function render() {
  const path = getCurrentRoute();

  const loader = routes[path] || routes["/"];

  if (!loader) {
    console.error("Extro: route not found", path);
    return;
  }

  const mod = await loader();
  const Component = mod.default;

  root.render(React.createElement(Component));
}

window.addEventListener("hashchange", render);

render();
`;
};
