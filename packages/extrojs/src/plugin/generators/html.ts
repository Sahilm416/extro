interface GenerateHTMLOptions {
  surface: string;
  dev?: { port: number };
}

/**
 * @describe Generates the HTML shell for a surface. In dev mode, the shell
 * points at the Vite dev server (with @vite/client for HMR) instead of the
 * built bundle, and pre-renders a brand-styled "dev server offline" screen
 * inside #root. React's createRoot replaces #root's children on mount, so
 * the screen vanishes on a normal start; if the dev server never comes up,
 * the screen stays visible.
 */
export function generateHTML({ surface, dev }: GenerateHTMLOptions) {
  const title = surface.charAt(0).toUpperCase() + surface.slice(1);

  const scripts = dev
    ? `
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
}

/**
 * @describe Renders a brand-styled "developer screen" card. Used as the
 * pre-render inside #root for offline-dev-server fallback today, intended
 * for reuse in other build-time / runtime dev panels.
 */
export const renderDevScreen = ({ title, body, fill = false }: DevScreen) => {
  const cls = `extro-dev-screen${fill ? " extro-dev-screen--fill" : ""}`;
  return `
<div class="${cls}">
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
 * is painted dark only while a screen is in the DOM (via `:has()`), so the
 * user's app reverts to default styling once React mounts.
 */
export const devScreenStyles = () => `
<style>
  body { margin: 0; }
  body:has(.extro-dev-screen) { background: #0a0a0a; }
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
    animation: extro-dev-screen-in 0.18s 0.05s forwards;
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
