interface GenerateDevBridgeOptions {
  signalPort: number;
  /** Absolute path to the user's background entry, if any. */
  userBackground?: string;
}

/**
 * @file runtimes/dev-bridge.ts
 * @description Generates the virtual `background` entry in dev mode.
 *
 * In dev, every extension gets a background service worker — even if the
 * user didn't write one — so we can run a tiny WebSocket client that listens
 * for rebuild signals from the CLI and reloads the extension + matching
 * tabs. If the user *did* write a background, we import it alongside the
 * bridge.
 *
 * Why not Vite's own HMR WebSocket? Because (a) the extension's BG SW isn't
 * a Vite-managed module, and (b) the build watcher is a separate Vite
 * instance from the dev server. The CLI owns its own tiny WS server and
 * routes rebuild events through it.
 */
export function generateDevBridgeModule({
  signalPort,
  userBackground,
}: GenerateDevBridgeOptions): string {
  const userImport = userBackground
    ? `import ${JSON.stringify(userBackground)};\n`
    : "";

  return `${userImport}
;(function extroDevBridge() {
  const SIGNAL_URL = "ws://localhost:${signalPort}";
  let socket;

  const reloadExtension = async () => {
    try {
      const manifest = chrome.runtime.getManifest();
      const matches = manifest.content_scripts?.[0]?.matches ?? [];
      if (matches.length > 0) {
        const tabs = await chrome.tabs.query({ url: matches });
        for (const tab of tabs) {
          if (tab.id != null) {
            try { await chrome.tabs.reload(tab.id); } catch {}
          }
        }
      }
    } catch (err) {
      console.warn("[extro] tab reload skipped:", err);
    }
    chrome.runtime.reload();
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
        reloadExtension();
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
