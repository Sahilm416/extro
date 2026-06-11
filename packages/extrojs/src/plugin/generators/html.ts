interface GenerateHTMLOptions {
  surface: string;
  dev?: { port: number };
}

/**
 * The dev probe script emitted next to the HTML shells in the dev output
 * dir. Referenced by the shells and reserved against Public assets, so the
 * name lives here once.
 */
export const DEV_PROBE_FILE = "extro-dev.js";

/**
 * @describe Generates the HTML shell for a surface. In dev mode, the shell
 * points at the Vite dev server (with @vite/client for HMR) instead of the
 * built bundle, and carries a hidden brand-styled "dev server offline"
 * screen inside #root. The probe script (generateDevProbe) reveals it only
 * when the dev server is unreachable; on a normal start it never paints,
 * and React's createRoot replaces #root's children on mount.
 */
export function generateHTML({ surface, dev }: GenerateHTMLOptions) {
  const title = surface.charAt(0).toUpperCase() + surface.slice(1);

  const scripts = dev
    ? `
      <script src="./${DEV_PROBE_FILE}"></script>
      <script type="module" src="http://localhost:${dev.port}/@vite/client"></script>
      <script type="module" src="http://localhost:${dev.port}/@id/@vitejs/plugin-react/preamble"></script>
      <script type="module" src="http://localhost:${dev.port}/@id/virtual:extro/runtime/${surface}"></script>
    `
    : `<script type="module" src="./${surface}.js"></script>`;

  const rootContent = dev
    ? renderDevScreen({
        title: "Dev server isn't running",
        body: `
          <p>Start it with <code>extro dev</code>, then reopen this surface.</p>
          <p>Expected at <code>http://localhost:${dev.port}</code>.</p>
        `,
        // Popups size to content (no viewport to fill); everything else
        // (options/sidepanel/tab) gets a full-viewport centered layout.
        fill: surface !== "popup",
        // Hidden until the probe proves the dev server is down, so a normal
        // start never paints it (the screen used to flash for the moment
        // between document load and React mount).
        hidden: true,
      })
    : "";

  return `
  <!doctype html>
  <html>
    <head>
      <title>${title}</title>
      ${dev ? devScreenStyles() : ""}
    </head>
    <body>
      <div id="root">${rootContent}</div>
      ${scripts.trim()}
    </body>
  </html>
  `.trim();
}

export interface DevScreen {
  title: string;
  /** HTML body content (paragraphs, code, etc.). Inserted as-is. */
  body: string;
  /**
   * When true, the screen fills the viewport and centers its card. Use for
   * surfaces with a real viewport (options tab, sidepanel). When false
   * (popup), the screen sizes to content with a fixed minimum.
   */
  fill?: boolean;
  /**
   * When true, the screen ships with the `hidden` attribute and stays out
   * of the first paint until something removes it (the dev probe, for the
   * offline screen).
   */
  hidden?: boolean;
}

/**
 * @describe Renders a brand-styled "developer screen" card. Used as the
 * pre-render inside #root for offline-dev-server fallback today, intended
 * for reuse in other build-time / runtime dev panels.
 */
export const renderDevScreen = ({
  title,
  body,
  fill = false,
  hidden = false,
}: DevScreen) => {
  const cls = `extro-dev-screen${fill ? " extro-dev-screen--fill" : ""}`;
  return `
<div class="${cls}"${hidden ? " hidden" : ""}>
  <div class="extro-dev-screen__card">
    <span class="extro-dev-screen__tag">EXTRO</span>
    <h1>${title}</h1>
    ${body.trim()}
  </div>
</div>
`.trim();
};

/**
 * @describe Global styles for any `.extro-dev-screen` rendered in dev. Body
 * is painted dark only while a visible screen is in the DOM (via `:has()`),
 * so the user's app keeps default styling both before React mounts (screen
 * still hidden) and after (screen wiped from #root).
 */
export const devScreenStyles = () => `
<style>
  body { margin: 0; }
  body:has(.extro-dev-screen:not([hidden])) { background: #0a0a0a; }
  .extro-dev-screen {
    box-sizing: border-box;
    min-width: 360px;
    min-height: 240px;
    padding: 24px 28px;
    background: #0a0a0a;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    animation: extro-dev-screen-in 0.18s forwards;
  }
  .extro-dev-screen[hidden] {
    display: none;
  }
  .extro-dev-screen--fill {
    min-height: 100vh;
  }
  .extro-dev-screen__card {
    box-sizing: border-box;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    color: #e5e5e5;
  }
  .extro-dev-screen__tag {
    align-self: flex-start;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    color: #0a0a0a;
    background: #CC785C;
    border-radius: 3px;
  }
  .extro-dev-screen h1 {
    margin: 4px 0 0;
    font-size: 15px;
    font-weight: 600;
    color: #fafafa;
  }
  .extro-dev-screen p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: #a3a3a3;
  }
  .extro-dev-screen code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    padding: 1px 6px;
    color: #CC785C;
    background: #1a1a1a;
    border-radius: 3px;
  }
  @keyframes extro-dev-screen-in { to { opacity: 1; } }
</style>
`.trim();

/**
 * @describe Generates the dev probe (`extro-dev.js`), emitted into the dev
 * output dir next to the HTML shells. MV3 CSP bans inline scripts but allows
 * 'self', so the probe loads from the extension origin and runs even when
 * the Vite dev server is down. It reveals the hidden offline screen only
 * when the @vite/client script fails to fetch, the one unambiguous signal
 * that the server is unreachable; a failing user module while the server is
 * up stays Vite's error overlay's problem.
 */
export const generateDevProbe = ({ port }: { port: number }) => `
// Generated by Extro. Reveals the "dev server isn't running" screen when
// the Vite dev server can't be reached. Script fetch errors don't bubble,
// hence the capture-phase listener; this classic script runs before the
// module scripts below it can fail.
window.addEventListener(
  "error",
  (event) => {
    const el = event.target;
    if (!(el instanceof HTMLScriptElement)) return;
    if (el.src !== "http://localhost:${port}/@vite/client") return;
    document.querySelector(".extro-dev-screen")?.removeAttribute("hidden");
  },
  true,
);
`.trimStart();
