interface GenerateHTMLOptions {
  surface: string;
  dev?: { port: number };
}

/**
 * @describe Generates the HTML shell for a surface. In dev mode, the shell
 * points at the Vite dev server (with @vite/client for HMR) instead of the
 * built bundle.
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

  return `
  <!doctype html>
  <html>
    <head>
      <title>${title}</title>
    </head>
    <body>
      <div id="root"></div>
      ${scripts.trim()}
    </body>
  </html>
  `.trim();
}
