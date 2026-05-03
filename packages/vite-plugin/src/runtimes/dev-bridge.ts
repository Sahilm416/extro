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
 * The bridge connects to the CLI's signal WS. On `scripts-rebuilt` (BG/CS
 * bundle changed) we either:
 *   - With CSUI: message tabs (`csui-update`) so the mount runtime soft
 *     re-imports `chrome.runtime.getURL("content.js")` and remounts the
 *     React tree. The host page survives.
 *   - Without CSUI: reload matching tabs and the extension itself.
 *
 * `vite-hmr` payloads are also forwarded to tabs for any future dev-tools
 * surface that wants to consume them; the current CSUI mount runtime
 * doesn't act on them (Stage 1 keeps things simple — full RFR for CSUI is
 * future work blocked on a non-localhost transport, since Chrome's Local
 * Network Access guard blocks public HTTPS pages from reaching localhost
 * without a per-site user grant).
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
      if (msg.kind === "scripts-rebuilt") onScriptsRebuilt();
      else if (msg.kind === "vite-hmr") onViteHmr(msg.payload);
    });

    signalSocket.addEventListener("close", () => {
      setTimeout(connectSignal, 1000);
    });

    signalSocket.addEventListener("error", () => {
      try { signalSocket.close(); } catch {}
    });
  };

  connectSignal();
})();
`;
}
