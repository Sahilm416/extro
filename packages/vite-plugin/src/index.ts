import type { Plugin } from "vite";
import type { ExtroConfig } from "@extro/types";
import react from "@vitejs/plugin-react";

import { findExtensionEntries } from "./entries.js";
import { generateManifest } from "./manifest.js";
import {
  HTML_SURFACES,
  ROUTABLE_SURFACES,
  type RoutableSurface,
} from "./constants.js";
import { findSurfaceRoutes, type Route } from "./routes.js";

import { emitIcons } from "./generators/icons.js";
import { generateHTML } from "./generators/html.js";

import { generateRoutesModule } from "./runtimes/routes-module.js";
import { generateRuntimeModule } from "./runtimes/runtime-module.js";

import { readJson } from "./utils/read-json.js";

// Virtual IDs follow a slash-namespaced convention so each surface has its
// own runtime + routes module. Resolved IDs are prefixed with "\0" per
// Rollup's convention for internal/virtual modules.
const routesId = (surface: RoutableSurface) => `virtual:extro/routes/${surface}`;
const runtimeId = (surface: RoutableSurface) => `virtual:extro/runtime/${surface}`;
const resolved = (id: string) => `\0${id}`;

interface ExtroPluginOptions {
  root: string;
  config?: ExtroConfig;
}

export function extro(options: ExtroPluginOptions): Plugin {
  const root = options.root;
  const config = options.config ?? {};

  let entries: Record<string, string> = {};
  const surfaceRoutes = new Map<RoutableSurface, Route[]>();

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
          "Extro: No extension entrypoints found.\n\nExpected files like:\n  src/app/popup/page.tsx\n  src/app/options/page.tsx\n  src/app/sidepanel/page.tsx\n  src/app/background/index.ts\n  src/app/content/index.ts",
        );
      }

      for (const surface of ROUTABLE_SURFACES) {
        if (!entries[surface]) continue;
        surfaceRoutes.set(surface, await findSurfaceRoutes({ root, surface }));
      }

      pkg = readJson<typeof pkg>("package.json", root) ?? {};

      const input: Record<string, string> = { ...entries };

      // For each routable surface present, rewrite its input to point at the
      // virtual runtime module so the bundled <surface>.js boots the router.
      for (const surface of ROUTABLE_SURFACES) {
        if (!entries[surface]) continue;
        input[surface] = runtimeId(surface);
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
      for (const surface of ROUTABLE_SURFACES) {
        if (id === runtimeId(surface)) return resolved(runtimeId(surface));
        if (id === routesId(surface)) return resolved(routesId(surface));
      }
    },

    load(id) {
      for (const surface of ROUTABLE_SURFACES) {
        if (id === resolved(runtimeId(surface))) {
          return generateRuntimeModule({ surface });
        }
        if (id === resolved(routesId(surface))) {
          return generateRoutesModule({
            routes: surfaceRoutes.get(surface) ?? [],
          });
        }
      }
    },
  };
}
