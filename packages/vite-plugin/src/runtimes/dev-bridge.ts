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
 * In dev, every extension gets a background service worker — even if the
 * user didn't write one — so we can run a tiny WebSocket client that listens
 * for rebuild signals from the CLI and updates the running surfaces:
 *
 *   - With CSUI: forward `csui-update` to all tabs via chrome.runtime
 *     messaging; the CSUI mount runtime re-imports itself in place. Host
 *     pages are NOT reloaded.
 *   - Without CSUI: reload tabs whose URL matches the content script (so
 *     fresh CS code is injected) — this loses host page state but it's the
 *     only option for plain content scripts.
 *
 *   In both cases, `chrome.runtime.reload()` follows so a new BG SW is
 *   started with the rebuilt code.
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
  let socket;

  const messageAllTabs = async () => {
    let count = 0;
    try {
      const tabs = await chrome.tabs.query({});
      await Promise.all(
        tabs.map(async (tab) => {
          if (tab.id == null) return;
          try {
            await chrome.tabs.sendMessage(tab.id, { kind: "csui-update" });
            count++;
          } catch {}
        }),
      );
    } catch (err) {
      console.warn("[extro] csui-update broadcast failed:", err);
    }
    console.log("[extro] csui-update sent to " + count + " tab(s)");
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
      // Message tabs so the CSUI runtime re-imports content.js in place.
      // We skip chrome.runtime.reload() here — the in-flight dynamic-import
      // in each CS would race with the extension restart and fail silently.
      // Cost: BG/manifest code changes need a manual 'extro dev' restart.
      await messageAllTabs();
    } else {
      await reloadMatchingTabs();
      chrome.runtime.reload();
    }
  };

  const connect = () => {
    socket = new WebSocket(SIGNAL_URL);

    socket.addEventListener("open", () => {
      console.log("[extro] dev bridge connected");
    });

    socket.addEventListener("message", (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg && msg.kind === "scripts-rebuilt") {
        onScriptsRebuilt();
      }
    });

    socket.addEventListener("close", () => {
      // Dev server probably restarted; back off and try again.
      setTimeout(connect, 1000);
    });

    socket.addEventListener("error", () => {
      try { socket.close(); } catch {}
    });
  };

  connect();
})();
`;
}
