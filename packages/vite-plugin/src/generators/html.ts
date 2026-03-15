interface GenerateHTMLOptions {
  surface: string;
}

/**
 * @file generators/html.ts
 * @description Generates the HTML shell for a given surface.
 */
export function generateHTML({ surface }: GenerateHTMLOptions) {
  const title = surface.charAt(0).toUpperCase() + surface.slice(1);
  return `
  <!doctype html>
  <html>
    <head>
      <title>${title}</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="./${surface}.js"></script>
    </body>
  </html>
  `.trim();
}
