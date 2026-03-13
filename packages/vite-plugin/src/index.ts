import type { Plugin } from "vite";
import { findExtensionEntries } from "./entries.js";
import { generateManifest } from "./manifest.js";

const POPUP_RUNTIME_ID = "virtual:extro-popup-runtime";
const RESOLVED_POPUP_RUNTIME_ID = "\0" + POPUP_RUNTIME_ID;

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

      const input = {...entries}
      if (entries.popup) {
        input.popup = POPUP_RUNTIME_ID;
      }

      return {
        build: {
          rollupOptions: {
            input,
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
    resolveId(id) {
      if (id === POPUP_RUNTIME_ID) {
        return RESOLVED_POPUP_RUNTIME_ID;
      }
    },
    load(id) {
      if (id === RESOLVED_POPUP_RUNTIME_ID) {
        const popupEntry = entries.popup;

        return `
    import React from "react"
    import { createRoot } from "react-dom/client"
    import Component from "${popupEntry}"
    
    const el = document.getElementById("root")
    
    if (!el) {
      throw new Error("Extro: #root element not found")
    }
    
    createRoot(el).render(React.createElement(Component))
    `;
      }
    },
  };
}
