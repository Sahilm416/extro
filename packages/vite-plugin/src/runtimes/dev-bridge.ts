interface GenerateDevBridgeOptions {
  signalPort: number;
  /**
   * Vite dev server port. The BG SW (chrome-extension:// origin) can reach
   * `http://localhost:<vitePort>` even on sites where Local Network Access
   * would block a public-origin fetch — so the BG is the only place that
   * can ferry transformed module source to content scripts.
   */
  vitePort: number;
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
 * The bridge connects to the CLI's signal WS. The CLI splits the rebuild
 * signal by which entry changed:
 *   - `bg-rebuilt` (background bundle changed): restart the extension via
 *     `chrome.runtime.reload()` only. Tabs / CSUI are left untouched.
 *   - `cs-rebuilt` (content/CSUI bundle changed): with CSUI, message tabs
 *     (`csui-update`) so the mount runtime soft re-imports
 *     `chrome.runtime.getURL("content.js")` and remounts the React tree, the
 *     host page surviving; without CSUI, reload matching tabs. The extension
 *     itself is NOT reloaded for a content-only change.
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
  vitePort,
  userBackground,
  hasCSUI,
}: GenerateDevBridgeOptions): string {
  const userImport = userBackground
    ? `import ${JSON.stringify(userBackground)};\n`
    : "";

  return `${userImport}
;(function extroDevBridge() {
  // If Chrome's in-memory manifest predates this dev session (e.g. it last
  // loaded from a prod build), the CSP won't allow our signal WS. Force a
  // reload so Chrome re-reads the dev manifest from disk. The new SW spawn
  // sees the updated CSP and skips this branch.
  const csp = chrome.runtime.getManifest().content_security_policy?.extension_pages ?? "";
  if (!csp.includes("ws://localhost:${signalPort}")) {
    chrome.runtime.reload();
    return;
  }

  const SIGNAL_URL = "ws://localhost:${signalPort}";
  const VITE_ORIGIN = "http://localhost:${vitePort}";
  const HAS_CSUI = ${hasCSUI ? "true" : "false"};

  let signalSocket = null;
  let wasDisconnected = false;

  // ---------------------------------------------------------------------
  // Keep-alive — Chrome MV3 terminates idle SWs after ~30s. Without this,
  // the signal WS dies between edits and HMR silently stops working.
  // Periodic chrome.* API calls register as activity and prevent
  // termination. Dev-only; the prod build doesn't ship this bridge.
  // ---------------------------------------------------------------------

  setInterval(() => {
    chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20_000);

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  const messageMatchingTabs = async (msg) => {
    let count = 0;
    try {
      const manifest = chrome.runtime.getManifest();
      const matches = manifest.content_scripts?.[0]?.matches ?? [];
      if (matches.length === 0) return 0;
      const tabs = await chrome.tabs.query({ url: matches });
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

  const onBgRebuilt = () => {
    console.log("[extro] bg-rebuilt signal received");
    // A service worker can't be hot-swapped; the only way to pick up new
    // background code is to restart the extension. Deliberately does NOT
    // message tabs or send csui-update — a BG-only edit leaves content
    // scripts / CSUI alone.
    chrome.runtime.reload();
  };

  const onCsRebuilt = async () => {
    console.log("[extro] cs-rebuilt signal received");
    if (HAS_CSUI) {
      const count = await messageMatchingTabs({ kind: "csui-update" });
      console.log("[extro] csui-update sent to " + count + " tab(s)");
    } else {
      await reloadMatchingTabs();
    }
    // Deliberately NO chrome.runtime.reload() — a content-only edit is
    // picked up when the tab reloads (content.js re-injected) or when CSUI
    // soft-remounts. Reloading the extension here was the old bug.
  };

  // ---------------------------------------------------------------------
  // RFR transport — fetch transformed module source from the Vite dev
  // server (only the BG SW's chrome-extension:// origin can reliably do
  // this; content scripts are blocked by Local Network Access on public
  // sites). The fetched source is forwarded to tabs for the CSUI HMR
  // client to evaluate via react-refresh.
  // ---------------------------------------------------------------------

  const fetchModuleSource = async (path) => {
    try {
      const res = await fetch(VITE_ORIGIN + path);
      if (!res.ok) return null;
      return await res.text();
    } catch (err) {
      console.warn("[extro] failed to fetch " + path, err);
      return null;
    }
  };

  const onViteHmr = async (payload) => {
    // Forward the raw payload for any future consumer that wants the
    // unmodified Vite envelope.
    await messageMatchingTabs({ kind: "vite-hmr", payload });

    if (!HAS_CSUI || !payload || !Array.isArray(payload.updates)) return;

    const fetched = await Promise.all(
      payload.updates
        .filter((u) => u && u.type === "js-update" && u.path)
        .map(async (u) => {
          const code = await fetchModuleSource(u.path);
          return code ? { path: u.path, code, timestamp: u.timestamp } : null;
        }),
    );
    const modules = fetched.filter(Boolean);
    if (modules.length === 0) return;

    const count = await messageMatchingTabs({ kind: "rfr-update", modules });
    console.log("[extro] rfr-update " + modules.length + " module(s) -> " + count + " tab(s)");
  };

  // ---------------------------------------------------------------------
  // Signal WS
  // ---------------------------------------------------------------------

  const connectSignal = () => {
    signalSocket = new WebSocket(SIGNAL_URL);

    signalSocket.addEventListener("open", () => {
      // Wipe the pile of "WebSocket connection failed" entries Chrome
      // accumulated while dev was down. Only on reconnect, not the very
      // first connect, so we don't eat the user's pre-bridge BG logs.
      if (wasDisconnected) console.clear();
      wasDisconnected = false;
      console.log("[extro] Connected to dev server.");
    });

    signalSocket.addEventListener("message", (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!msg) return;
      if (msg.kind === "bg-rebuilt") onBgRebuilt();
      else if (msg.kind === "cs-rebuilt") onCsRebuilt();
      else if (msg.kind === "vite-hmr") onViteHmr(msg.payload);
    });

    signalSocket.addEventListener("close", () => {
      wasDisconnected = true;
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
