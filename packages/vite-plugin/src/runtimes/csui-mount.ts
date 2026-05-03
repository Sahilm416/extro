interface GenerateCSUIMountOptions {
  /** Absolute path to the user's `content/page.tsx`. */
  page: string;
  /** Absolute path to the user's `content/index.{ts,tsx}` if present. Imported for side effects. */
  script?: string;
  /** True in dev mode — installs the chrome.runtime listener for csui-update. */
  dev: boolean;
  /**
   * Virtual id of the dev-only mount entry served by Vite (e.g.
   * `virtual:extro/csui-dev-entry`). Set in dev; the bootloader native-imports
   * it from the dev server so React + the user's page stream from Vite
   * with full transform/HMR machinery.
   */
  devEntryId?: string;
}

/**
 * @file runtimes/csui-mount.ts
 * @description Generates the synthesized content script entry when the user
 * has `src/app/content/page.tsx`.
 *
 * Two modes:
 *   - Dev: tiny bootloader. Asks BG for the Vite origin, then native-imports
 *     the dev entry virtual module. The entry pulls React + the user's page
 *     through Vite's pipeline, exposes a `mount(target)` function. On
 *     `csui-update` we re-import with cache-bust and remount.
 *
 *   - Prod: static import of the user's page, bundled normally by Rollup.
 *
 * Re-mount strategy: stash the active root + host on `globalThis` so a
 * re-imported version can find the previous mount, tear it down, and
 * replace it cleanly.
 */
export function generateCSUIMountModule({
  page,
  script,
  dev,
  devEntryId,
}: GenerateCSUIMountOptions): string {
  const sideEffectImport = script ? `import ${JSON.stringify(script)};\n` : "";

  if (dev && devEntryId) {
    return `${sideEffectImport}
// @vitejs/plugin-react injects a preamble check at the top of every
// transformed React file. In a normal app the preamble is installed by
// transformIndexHtml; we have no HTML, so stub the globals here BEFORE
// importing any transformed code. Real RFR runtime wiring lands in Phase 3.
if (typeof window !== "undefined") {
  window.__vite_plugin_react_preamble_installed__ = true;
  if (typeof window.$RefreshReg$ !== "function") window.$RefreshReg$ = () => {};
  if (typeof window.$RefreshSig$ !== "function") window.$RefreshSig$ = () => (type) => type;
}

const STATE_KEY = "__extroCSUI__";
const DEV_ENTRY_PATH = "/@id/__x00__" + ${JSON.stringify(devEntryId)};

const teardown = () => {
  const existing = globalThis[STATE_KEY];
  if (!existing) return;
  try { existing.root.unmount(); } catch {}
  try { existing.host.remove(); } catch {}
  if (existing.handler) {
    try { chrome.runtime.onMessage.removeListener(existing.handler); } catch {}
  }
  delete globalThis[STATE_KEY];
};

const getOrigin = async () => {
  // Retry — BG may not have received the signal-WS hello yet.
  for (let i = 0; i < 50; i++) {
    try {
      const res = await chrome.runtime.sendMessage({ kind: "get-vite-origin" });
      if (res && res.origin) return res.origin;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("[extro] BG never reported a Vite origin");
};

// Cache the dev entry's exports — React + the user-page URL. Loaded once.
let devApi = null;

const loadDevApi = async () => {
  if (devApi) return devApi;
  const origin = await getOrigin();
  devApi = await import(/* @vite-ignore */ origin + DEV_ENTRY_PATH);
  return devApi;
};

const loadAndMount = async (cacheBust) => {
  let api;
  try {
    api = await loadDevApi();
  } catch (err) {
    console.error("[extro] CSUI dev entry import failed:", err);
    return;
  }

  // Import the user's page directly so cache-bust via ?t= works (Vite's
  // /@id/ middleware folds query into the module id; real file paths handle
  // queries correctly).
  const origin = await getOrigin();
  const pageUrl = origin + api.PAGE_URL + (cacheBust ? "?t=" + Date.now() : "");
  let pageMod;
  try {
    pageMod = await import(/* @vite-ignore */ pageUrl);
  } catch (err) {
    console.error("[extro] CSUI page import failed:", err);
    return;
  }
  const Component = pageMod.default;
  if (!Component) {
    console.error("[extro] " + api.PAGE_URL + " has no default export");
    return;
  }

  teardown();

  const host = document.createElement("div");
  host.id = "extro-csui-root";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  const root = api.createRoot(shadow);
  root.render(api.createElement(Component));

  // Trigger re-mount on any update — both BG/CS bundle rebuilds (csui-update)
  // and dev-server HMR events on user files (vite-hmr). Phase 3 will replace
  // the vite-hmr branch with proper RFR so state survives.
  let pending = false;
  const scheduleReload = () => {
    if (pending) return;
    pending = true;
    Promise.resolve().then(() => {
      pending = false;
      loadAndMount(true);
    });
  };
  const handler = (msg) => {
    if (!msg) return;
    if (msg.kind === "csui-update") scheduleReload();
    else if (msg.kind === "vite-hmr") scheduleReload();
  };
  try { chrome.runtime.onMessage.addListener(handler); } catch {}

  globalThis[STATE_KEY] = { root, host, handler };
};

loadAndMount(false);
`;
  }

  return `${sideEffectImport}import UserComponent from ${JSON.stringify(page)};
import { createElement } from "react";
import { createRoot } from "react-dom/client";

const STATE_KEY = "__extroCSUI__";

const teardown = () => {
  const existing = globalThis[STATE_KEY];
  if (!existing) return;
  try { existing.root.unmount(); } catch {}
  try { existing.host.remove(); } catch {}
  delete globalThis[STATE_KEY];
};

const mount = (Component) => {
  teardown();

  const host = document.createElement("div");
  host.id = "extro-csui-root";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  const root = createRoot(shadow);
  root.render(createElement(Component));

  globalThis[STATE_KEY] = { root, host };
};

mount(UserComponent);
`;
}
