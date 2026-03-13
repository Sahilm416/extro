import type { Plugin } from "vite";
import { findExtensionEntries } from "./entries.js";
import { generateManifest } from "./manifest.js";

export function extro(options: { root: string }): Plugin {
  const root = options.root;
  let entries: Record<string, string> = {};

  return {
    name: "extro",

    async config() {
      entries = await findExtensionEntries(root);

      if (Object.keys(entries).length === 0) {
        throw new Error(
          "Extro: No extension entrypoints found.\n\nExpected files like:\n  popup/page.tsx\n  background/index.ts\n  content/index.ts",
        );
      }

      console.log("Extro entries:", entries);

      return {
        build: {
          rollupOptions: {
            input: entries,
            output: {
              entryFileNames: "[name].js",
            },
          },
        },
      };
    },

    generateBundle() {
      const manifest = generateManifest(entries);

      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifest, null, 2),
      });

      if (entries.popup) {
        const html = `
    <!doctype html>
    <html>
      <body>
        <div id="root"></div>
        <script type="module" src="./popup.js"></script>
      </body>
    </html>
    `.trim();

        this.emitFile({
          type: "asset",
          fileName: "popup.html",
          source: html,
        });
      }
    },
  };
}
