import "virtual:extro/user/content-script";
import UserComponent from "virtual:extro/user/content-page";
import { config } from "virtual:extro/csui-mount/config";
import { createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";

const STATE_KEY = "__extroCSUI__" as const;

interface CSUIState {
  root: Root;
  host: HTMLDivElement;
  handler?: (msg: unknown) => void;
}

interface RFRUpdateMessage {
  kind: "rfr-update";
  modules: Array<{ path: string; code: string; timestamp?: number }>;
}

interface CSUIUpdateMessage {
  kind: "csui-update";
}

type IncomingMessage = RFRUpdateMessage | CSUIUpdateMessage | { kind: string };

const getState = (): CSUIState | undefined =>
  (globalThis as unknown as Record<string, CSUIState | undefined>)[STATE_KEY];

const setState = (state: CSUIState | undefined): void => {
  const slot = globalThis as unknown as Record<string, CSUIState | undefined>;
  if (state) slot[STATE_KEY] = state;
  else delete slot[STATE_KEY];
};

const teardownState = (state: CSUIState): void => {
  try { state.root.unmount(); } catch {}
  try { state.host.remove(); } catch {}
  if (state.handler) {
    try { chrome.runtime.onMessage.removeListener(state.handler); } catch {}
  }
};

const mount = (Component: ComponentType): void => {
  const previous = getState();

  // Build the new tree on top of the old without removing the old first.
  // Both hosts use position:fixed at the same coordinates, so they perfectly
  // overlap; the user sees no gap. The old host is torn down on the next
  // frame, by which time React has committed + painted the new tree.
  const host = document.createElement("div");
  host.id = "extro-csui-root";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  const root = createRoot(shadow);
  // flushSync so the new tree is committed to the DOM before we return; the
  // subsequent rAF then reliably runs after the new tree exists. Without it,
  // React's async commit can race with the rAF callback and the teardown
  // fires on a blank frame, producing an intermittent flash.
  flushSync(() => root.render(createElement(Component)));

  if (previous) {
    requestAnimationFrame(() => teardownState(previous));
  }

  if (!config.dev) {
    setState({ root, host });
    return;
  }

  // In-flight gate: drop csui-update messages while a re-import is already
  // running so we don't queue redundant mount/teardown cycles when several
  // signals arrive in quick succession.
  let importPending = false;

  const handler = (raw: unknown): void => {
    const msg = raw as IncomingMessage | null;
    if (!msg) return;

    // RFR transport probe — slice 1 just logs that BG-fetched module
    // sources are arriving end-to-end. Evaluation + react-refresh wiring
    // come in later slices.
    if (msg.kind === "rfr-update" && Array.isArray((msg as RFRUpdateMessage).modules)) {
      const modules = (msg as RFRUpdateMessage).modules;
      console.log("[extro] rfr-update received:", modules.map((m) => ({
        path: m.path,
        bytes: m.code ? m.code.length : 0,
      })));
      return;
    }

    if (msg.kind !== "csui-update") return;
    if (importPending) return;
    importPending = true;
    const url = chrome.runtime.getURL("content.js") + "?v=" + Date.now();
    import(/* @vite-ignore */ url)
      .catch((err) => console.error("[extro] csui re-import failed:", err))
      .finally(() => { importPending = false; });
  };

  try { chrome.runtime.onMessage.addListener(handler); } catch {}
  setState({ root, host, handler });
};

mount(UserComponent);
