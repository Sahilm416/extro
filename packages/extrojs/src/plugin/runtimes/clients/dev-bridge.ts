import "virtual:extro/user/background";
import { config } from "virtual:extro/dev-bridge/config";

/**
 * @file runtimes/clients/dev-bridge.ts
 * @description The MV3 service-worker bridge run by `extro dev`.
 *
 * Responsibilities:
 *   - Connect to the CLI's signal WS and react to:
 *       bg-rebuilt  → `chrome.runtime.reload()` (only way to swap BG code).
 *       cs-rebuilt  → CSUI-aware re-mount via `csui-update`, else tab reload.
 *       vite-hmr    → fetch transformed module source from the dev server
 *                     and forward to tabs as `rfr-update` for the CSUI
 *                     runtime's react-refresh client.
 *   - Keep the service worker alive past the MV3 idle timeout so the WS
 *     doesn't die between edits.
 *   - Restart the extension if the in-memory manifest predates this dev
 *     session (CSP would block our signal WS otherwise).
 *
 * Why the BG SW does the dev-server fetch (not content scripts):
 *   Chrome's Local Network Access blocks public HTTPS pages from reaching
 *   localhost without a per-site user grant. Only the chrome-extension://
 *   origin can reliably fetch http://localhost:<vitePort>.
 */

(function extroDevBridge(): void {
  // If Chrome's in-memory manifest predates this dev session (e.g. it last
  // loaded from a prod build), the CSP won't allow our signal WS. Force a
  // reload so Chrome re-reads the dev manifest from disk. The new SW spawn
  // sees the updated CSP and skips this branch.
  const csp =
    chrome.runtime.getManifest().content_security_policy as
      | { extension_pages?: string }
      | undefined;
  const pages = csp?.extension_pages ?? "";
  if (!pages.includes(`ws://localhost:${config.signalPort}`)) {
    chrome.runtime.reload();
    return;
  }

  const SIGNAL_URL = `ws://localhost:${config.signalPort}`;
  const VITE_ORIGIN = `http://localhost:${config.vitePort}`;

  let signalSocket: WebSocket | null = null;
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
  // Tab helpers
  // ---------------------------------------------------------------------

  const messageMatchingTabs = async (msg: object): Promise<number> => {
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

  const reloadMatchingTabs = async (): Promise<void> => {
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

  // ---------------------------------------------------------------------
  // RFR transport — fetch transformed module source from the Vite dev
  // server (BG SW is the only origin that reliably reaches localhost on
  // sites where Local Network Access would block a public-origin fetch).
  // ---------------------------------------------------------------------

  const fetchModuleSource = async (modPath: string): Promise<string | null> => {
    try {
      const res = await fetch(VITE_ORIGIN + modPath);
      if (!res.ok) return null;
      return await res.text();
    } catch (err) {
      console.warn("[extro] failed to fetch " + modPath, err);
      return null;
    }
  };

  // ---------------------------------------------------------------------
  // Signal handlers
  // ---------------------------------------------------------------------

  const onBgRebuilt = (): void => {
    console.log("[extro] bg-rebuilt signal received");
    // A service worker can't be hot-swapped; the only way to pick up new
    // background code is to restart the extension. Deliberately does NOT
    // message tabs or send csui-update — a BG-only edit leaves content
    // scripts / CSUI alone.
    chrome.runtime.reload();
  };

  const onCsRebuilt = async (): Promise<void> => {
    console.log("[extro] cs-rebuilt signal received");
    if (config.hasCSUI) {
      const count = await messageMatchingTabs({ kind: "csui-update" });
      console.log(`[extro] csui-update sent to ${count} tab(s)`);
    } else {
      await reloadMatchingTabs();
    }
    // Deliberately NO chrome.runtime.reload() — a content-only edit is
    // picked up when the tab reloads (content.js re-injected) or when
    // CSUI soft-remounts.
  };

  interface HmrUpdate {
    type: string;
    path: string;
    acceptedPath: string;
    timestamp: number;
  }
  interface HmrPayload {
    type: "update";
    updates: HmrUpdate[];
  }

  const onViteHmr = async (payload: HmrPayload): Promise<void> => {
    // Forward the raw payload for any future consumer that wants the
    // unmodified Vite envelope.
    await messageMatchingTabs({ kind: "vite-hmr", payload });

    if (!config.hasCSUI || !payload || !Array.isArray(payload.updates)) return;

    const fetched = await Promise.all(
      payload.updates
        .filter((u) => u && u.type === "js-update" && u.path)
        .map(async (u) => {
          const code = await fetchModuleSource(u.path);
          return code ? { path: u.path, code, timestamp: u.timestamp } : null;
        }),
    );
    const modules = fetched.filter((m): m is NonNullable<typeof m> => m !== null);
    if (modules.length === 0) return;

    const count = await messageMatchingTabs({ kind: "rfr-update", modules });
    console.log(`[extro] rfr-update ${modules.length} module(s) -> ${count} tab(s)`);
  };

  // ---------------------------------------------------------------------
  // Signal WS
  // ---------------------------------------------------------------------

  const connectSignal = (): void => {
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
      let msg: { kind?: string; payload?: HmrPayload } | null;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!msg) return;
      if (msg.kind === "bg-rebuilt") onBgRebuilt();
      else if (msg.kind === "cs-rebuilt") onCsRebuilt();
      else if (msg.kind === "vite-hmr" && msg.payload) onViteHmr(msg.payload);
    });

    signalSocket.addEventListener("close", () => {
      wasDisconnected = true;
      setTimeout(connectSignal, 1000);
    });

    signalSocket.addEventListener("error", () => {
      try { signalSocket?.close(); } catch {}
    });
  };

  connectSignal();
})();
