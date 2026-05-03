interface GenerateDevBridgeOptions {
  signalPort: number;
  /** Absolute path to the user's background entry, if any. */
  userBackground?: string;
  /**
   * When true, CSUI is present — the bridge messages tabs (`csui-update`)
   * instead of reloading them, so the host page survives across edits.
   */
  hasCSUI: boolean;
}

/**
 * @file runtimes/dev-bridge.ts
 * @description Generates the virtual `background` entry in dev mode.
 *
 * The bridge connects to a single WS — the CLI's signal server — and
 * receives three message kinds:
 *
 *   - `hello` (on connect): carries the current Vite port. Stashed for
 *     `fetch-module` to know where to fetch CS modules from.
 *
 *   - `scripts-rebuilt`: BG/CS bundle changed. With CSUI we message tabs
 *     (`csui-update`) so the mount runtime re-imports in place. Without
 *     CSUI we reload matching tabs and the extension itself.
 *
 *   - `vite-hmr`: HMR update payload (Vite's `update` shape) — forwarded
 *     to all tabs as `{kind: "vite-hmr", payload}` for the CSUI runtime
 *     to apply React Fast Refresh.
 *
 * We don't talk to Vite's HMR WS directly — its origin check rejects
 * chrome-extension:// service workers. Instead the extro plugin's
 * `handleHotUpdate` hook (running inside the dev server) serializes
 * updates and the CLI relays them through the signal WS.
 *
 * `fetch-module` (chrome.runtime message): CS asks BG to fetch a Vite
 * dev-server URL, BG fetches with extension-CSP, returns text.
 */
export function generateDevBridgeModule({
  signalPort,
  userBackground,
  hasCSUI,
}: GenerateDevBridgeOptions): string {
  const userImport = userBackground
    ? `import ${JSON.stringify(userBackground)};\n`
    : "";

  return `${userImport}
;(function extroDevBridge() {
  const SIGNAL_URL = "ws://localhost:${signalPort}";
  const HAS_CSUI = ${hasCSUI ? "true" : "false"};

  let viteOrigin = null;
  let signalSocket = null;

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  const messageAllTabs = async (msg) => {
    let count = 0;
    try {
      const tabs = await chrome.tabs.query({});
      await Promise.all(
        tabs.map(async (tab) => {
          if (tab.id == null) return;
          try {
            await chrome.tabs.sendMessage(tab.id, msg);
            count++;
          } catch {}
        }),
      );
    } catch {}
    return count;
  };

  const reloadMatchingTabs = async () => {
    try {
      const manifest = chrome.runtime.getManifest();
      const matches = manifest.content_scripts?.[0]?.matches ?? [];
      if (matches.length === 0) return;
      const tabs = await chrome.tabs.query({ url: matches });
      for (const tab of tabs) {
        if (tab.id != null) {
          try { await chrome.tabs.reload(tab.id); } catch {}
        }
      }
    } catch (err) {
      console.warn("[extro] tab reload skipped:", err);
    }
  };

  const onScriptsRebuilt = async () => {
    console.log("[extro] scripts-rebuilt signal received");
    if (HAS_CSUI) {
      // Skip chrome.runtime.reload() — the in-flight dynamic-import in each
      // CS would race with the extension restart and fail silently. Cost:
      // BG/manifest changes need a manual 'extro dev' restart.
      const count = await messageAllTabs({ kind: "csui-update" });
      console.log("[extro] csui-update sent to " + count + " tab(s)");
    } else {
      await reloadMatchingTabs();
      chrome.runtime.reload();
    }
  };

  const onViteHmr = async (payload) => {
    const count = await messageAllTabs({ kind: "vite-hmr", payload });
    if (payload && payload.type) {
      console.log("[extro] vite-hmr " + payload.type + " -> " + count + " tab(s)");
    }
  };

  // ---------------------------------------------------------------------
  // Signal WS
  // ---------------------------------------------------------------------

  const connectSignal = () => {
    signalSocket = new WebSocket(SIGNAL_URL);

    signalSocket.addEventListener("open", () => {
      console.log("[extro] signal WS connected");
    });

    signalSocket.addEventListener("message", (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!msg) return;
      if (msg.kind === "hello" && typeof msg.vitePort === "number") {
        viteOrigin = "http://localhost:" + msg.vitePort;
        console.log("[extro] hello: vitePort=" + msg.vitePort);
        return;
      }
      if (msg.kind === "scripts-rebuilt") {
        onScriptsRebuilt();
        return;
      }
      if (msg.kind === "vite-hmr") {
        onViteHmr(msg.payload);
        return;
      }
    });

    signalSocket.addEventListener("close", () => {
      viteOrigin = null;
      setTimeout(connectSignal, 1000);
    });

    signalSocket.addEventListener("error", () => {
      try { signalSocket.close(); } catch {}
    });
  };

  // ---------------------------------------------------------------------
  // fetch-module — CS asks BG to fetch a module from the dev server
  // ---------------------------------------------------------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.kind === "get-vite-origin") {
      sendResponse({ origin: viteOrigin });
      return;
    }
    if (msg.kind === "fetch-module") {
      if (!viteOrigin) {
        sendResponse({ ok: false, status: 0, text: "", error: "vite port not known yet" });
        return;
      }
      const url = typeof msg.url === "string" && msg.url.startsWith("/")
        ? viteOrigin + msg.url
        : msg.url;
      fetch(url)
        .then((r) => r.text().then((text) => ({ ok: r.ok, status: r.status, text })))
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ ok: false, status: 0, text: "", error: String(err) }));
      return true; // keep the channel open for async sendResponse
    }
  });

  connectSignal();
})();
`;
}
