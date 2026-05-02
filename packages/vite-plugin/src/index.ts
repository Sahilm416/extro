import type { Plugin } from "vite";
import type { ExtroConfig } from "@extro/types";
import react from "@vitejs/plugin-react";

import { scanAppTree, type AppTree } from "./app-tree.js";
import { emitAssets } from "./emit-assets.js";
import {
  ROUTABLE_SURFACES,
  type RoutableSurface,
} from "./surfaces.js";

import { emitIcons } from "./generators/icons.js";

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

  let tree: AppTree = { scripts: {}, surfaces: {} };

  let pkg: {
    name?: string;
    description?: string;
    version?: string;
  } = {};

  return {
    name: "extro",

    async config() {
      tree = await scanAppTree(root);

      const empty =
        Object.keys(tree.scripts).length === 0 &&
        Object.keys(tree.surfaces).length === 0;
      if (empty) {
        throw new Error(
          "Extro: No extension entrypoints found.\n\nExpected files like:\n  src/app/popup/page.tsx\n  src/app/options/page.tsx\n  src/app/sidepanel/page.tsx\n  src/app/background/index.ts\n  src/app/content/index.ts",
        );
      }

      pkg = readJson<typeof pkg>("package.json", root) ?? {};

      const input: Record<string, string> = { ...tree.scripts };

      // For each routable surface present, point its input at the virtual
      // runtime module so the bundled <surface>.js boots the router.
      for (const surface of ROUTABLE_SURFACES) {
        if (!tree.surfaces[surface]) continue;
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

    async generateBundle() {
      await emitAssets({ tree, root, pkg, config }, (fileName, source) => {
        this.emitFile({ type: "asset", fileName, source });
      });

      emitIcons({ ctx: this, root });
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
            routes: tree.surfaces[surface] ?? [],
          });
        }
      }
    },
  };
}
