import type { Plugin } from "vite";
import type { ExtroConfig } from "@extro/types";
import react from "@vitejs/plugin-react";

import { findExtensionEntries } from "./entries.js";
import { generateManifest } from "./manifest.js";
import { HTML_SURFACES } from "./constants.js";
import { findPopupRoutes, Route } from "./routes.js";

import { emitIcons } from "./generators/icons.js";
import { generateHTML } from "./generators/html.js";

import { generatePopupRoutesModule } from "./runtimes/popup-routes.js";
import { generatePopupRuntimeModule } from "./runtimes/popup-runtime.js";

import { readJson } from "./utils/read-json.js";

const POPUP_RUNTIME_ID = "virtual:extro-popup-runtime";
const RESOLVED_POPUP_RUNTIME_ID = "\0" + POPUP_RUNTIME_ID;

const POPUP_ROUTES_ID = "virtual:extro-popup-routes";
const RESOLVED_POPUP_ROUTES_ID = "\0" + POPUP_ROUTES_ID;

interface ExtroPluginOptions {
  root: string;
  config?: ExtroConfig;
}

export function extro(options: ExtroPluginOptions): Plugin {
  const root = options.root;
  const config = options.config ?? {};

  let entries: Record<string, string> = {};
  let routes: Route[] = [];

  let pkg: {
    name?: string;
    description?: string;
    version?: string;
  } = {};

  return {
    name: "extro",

    async config() {
      entries = await findExtensionEntries(root);

      if (Object.keys(entries).length === 0) {
        throw new Error(
          "Extro: No extension entrypoints found.\n\nExpected files like:\n  /page.tsx\n  /ext/background/index.ts\n  /ext/content/index.ts",
        );
      }

      routes = await findPopupRoutes(root);

      pkg = readJson<typeof pkg>("package.json", root) ?? {};

      const input = { ...entries };

      if (entries.popup) {
        input.popup = POPUP_RUNTIME_ID;
      }

      return {
        plugins: [react()],
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
      const manifest = generateManifest({
        entries,
        root,
        pkg,
        config,
      });

      emitIcons({ ctx: this, root });

      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifest, null, 2),
      });

      for (const surface of HTML_SURFACES) {
        if (!entries[surface]) continue;

        const html = generateHTML({ surface });

        this.emitFile({
          type: "asset",
          fileName: `${surface}.html`,
          source: html,
        });
      }
    },

    resolveId(id) {
      if (id === POPUP_RUNTIME_ID) return RESOLVED_POPUP_RUNTIME_ID;

      if (id === POPUP_ROUTES_ID) return RESOLVED_POPUP_ROUTES_ID;
    },

    load(id) {
      if (id === RESOLVED_POPUP_RUNTIME_ID) {
        return generatePopupRuntimeModule();
      }

      if (id === RESOLVED_POPUP_ROUTES_ID) {
        return generatePopupRoutesModule({ routes });
      }
    },
  };
}