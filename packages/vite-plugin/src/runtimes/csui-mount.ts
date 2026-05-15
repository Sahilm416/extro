interface GenerateCSUIMountOptions {
  /** Absolute path to the user's `content/page.tsx`. */
  page: string;
  /** Absolute path to the user's `content/index.{ts,tsx}` if present. Imported for side effects. */
  script?: string;
  /** True in dev mode — installs the chrome.runtime listener for csui-update. */
  dev: boolean;
}

/**
 * @file runtimes/csui-mount.ts
 * @description Generates the synthesized content script entry when the user
 * has `src/app/content/page.tsx`.
 *
 * The bundle:
 *   1. Runs the user's `content/index.{ts,tsx}` (side effects, listeners) if present.
 *   2. Creates a shadow-DOM host on the page and mounts the user's React component.
 *   3. In dev: listens for `csui-update` messages from the BG dev bridge and
 *      re-imports itself (with cache-bust) to swap in the new bundle without
 *      reloading the host page.
 *
 * Why not native-import from the Vite dev server?
 *   Chrome's Local Network Access (LNA) blocks public HTTPS pages from
 *   reaching localhost without an explicit user grant — every test site
 *   would prompt. Loading content.js by `chrome.runtime.getURL` (an
 *   `chrome-extension://` URL) bypasses LNA entirely.
 *
 * Re-mount strategy: stash the active root + host on `globalThis` so a
 * re-imported version can find the previous mount, tear it down, and
 * replace it cleanly. State resets on each mount; full RFR is a future
 * feature gated on a different transport (e.g. BG-tunneled fetches).
 */
export function generateCSUIMountModule({
  page,
  script,
  dev,
}: GenerateCSUIMountOptions): string {
  const sideEffectImport = script ? `import ${JSON.stringify(script)};\n` : "";

  return `${sideEffectImport}import UserComponent from ${JSON.stringify(page)};
import { createElement } from "react";
import { createRoot } from "react-dom/client";

const STATE_KEY = "__extroCSUI__";

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

const mount = (Component) => {
  teardown();

  const host = document.createElement("div");
  host.id = "extro-csui-root";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  const root = createRoot(shadow);
  root.render(createElement(Component));

  ${dev
    ? `// In-flight gate: drop csui-update messages while a re-import is already
  // running so we don't queue redundant mount/teardown cycles when several
  // signals arrive in quick succession.
  let importPending = false;
  const handler = (msg) => {
    if (!msg || msg.kind !== "csui-update") return;
    if (importPending) return;
    importPending = true;
    const url = chrome.runtime.getURL("content.js") + "?v=" + Date.now();
    import(/* @vite-ignore */ url)
      .catch((err) => {
        console.error("[extro] csui re-import failed:", err);
      })
      .finally(() => {
        importPending = false;
      });
  };
  try { chrome.runtime.onMessage.addListener(handler); } catch {}
  globalThis[STATE_KEY] = { root, host, handler };`
    : `globalThis[STATE_KEY] = { root, host };`}
};

mount(UserComponent);
`;
}
