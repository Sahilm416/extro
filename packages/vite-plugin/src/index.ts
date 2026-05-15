import path from "node:path";

import type { Plugin } from "vite";
import type { ExtroConfig } from "@extrojs/types";

import { scanAppTree, type AppTree } from "./app-tree.js";
import { emitAssets } from "./emit-assets.js";
import { SURFACES, type RoutableSurface } from "./surfaces.js";

import { emitIcons } from "./generators/icons.js";

import { generateRoutesModule } from "./runtimes/routes-module.js";
import { generateRuntimeModule } from "./runtimes/runtime-module.js";
import { generateDevBridgeModule } from "./runtimes/dev-bridge.js";
import { generateCSUIMountModule } from "./runtimes/csui-mount.js";

import { readJson } from "./utils/read-json.js";

// Virtual IDs follow a slash-namespaced convention so each surface has its
// own runtime + routes module. Resolved IDs are prefixed with "\0" per
// Rollup's convention for internal/virtual modules.
const routesId = (surface: RoutableSurface) => `virtual:extro/routes/${surface}`;
const runtimeId = (surface: RoutableSurface) => `virtual:extro/runtime/${surface}`;
const DEV_BG_ID = "virtual:extro/dev-background";
const CSUI_CONTENT_ID = "virtual:extro/csui-content";
const resolved = (id: string) => `\0${id}`;

interface ExtroPluginOptions {
  root: string;
  config?: ExtroConfig;
  /**
   * When true, only background/content are bundled. Manifest + HTML emission
   * is skipped (writeDevAssets handles those separately during `extro dev`).
   * Used by the dev build-watch sidecar.
   */
  scriptsOnly?: boolean;
  /**
   * When set, wrap the background entry in the dev bridge so a service
   * worker exists in dev mode (even if the user didn't write one) to
   * receive rebuild signals from the CLI's WS server and forward Vite HMR
   * events to content scripts.
   */
  devBridge?: { signalPort: number };
  /**
   * Called from the dev-server plugin's `handleHotUpdate` with a payload
   * shaped like Vite's own HMR `update` event. The CLI uses this to
   * broadcast HMR over the signal WS (avoiding Vite's HMR WS, whose
   * origin check rejects chrome-extension:// service workers).
   */
  broadcastHmr?: (payload: object) => void;
}

export function extro(options: ExtroPluginOptions): Plugin {
  const root = options.root;
  const config = options.config ?? {};
  const scriptsOnly = options.scriptsOnly ?? false;
  const devBridge = options.devBridge;
  const broadcastHmr = options.broadcastHmr;

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
      if (empty && !devBridge) {
        // In dev with bridge, an entry-less project still gets a synthesized
        // background SW for HMR signalling. Otherwise, complain.
        throw new Error(
          "Extro: No extension entrypoints found.\n\nExpected files like:\n  src/app/popup/page.tsx\n  src/app/options/page.tsx\n  src/app/sidepanel/page.tsx\n  src/app/background/index.ts\n  src/app/content/index.ts",
        );
      }

      pkg = readJson<typeof pkg>("package.json", root) ?? {};

      const input: Record<string, string> = {};

      const contentEntry = tree.scripts.content?.csui
        ? CSUI_CONTENT_ID
        : tree.scripts.content?.script;

      if (devBridge) {
        // Force a background entry in dev — wraps user's BG (if any) with
        // the WS bridge.
        input.background = DEV_BG_ID;
        if (contentEntry) input.content = contentEntry;
      } else if (scriptsOnly) {
        if (tree.scripts.background) input.background = tree.scripts.background;
        if (contentEntry) input.content = contentEntry;
      } else {
        if (tree.scripts.background) input.background = tree.scripts.background;
        if (contentEntry) input.content = contentEntry;
        for (const surface of Object.keys(tree.surfaces) as RoutableSurface[]) {
          input[surface] = runtimeId(surface);
        }
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

    async generateBundle() {
      if (scriptsOnly) return;

      await emitAssets({ tree, root, pkg, config }, (fileName, source) => {
        this.emitFile({ type: "asset", fileName, source });
      });
      emitIcons({ ctx: this, root });
    },

    configureServer(server) {
      if (scriptsOnly) return;

      server.watcher.add(path.join(root, "src/app/**/{page,index}.{ts,tsx}"));

      const isAppEntry = /^src\/app\/[^/]+\/(?:.+\/)?(?:page|index)\.tsx?$/;
      const routableSurfaceList = SURFACES
        .filter((s) => s.kind === "routable")
        .map((s) => s.name as RoutableSurface);

      const handleChange = async (file: string) => {
        const rel = path.relative(root, file).split(path.sep).join("/");
        if (!isAppEntry.test(rel)) return;

        const prevTree = tree;
        tree = await scanAppTree(root);

        // New background / content / surface → rollupOptions.input was fixed
        // at config() time, so a fresh dev session is required to register
        // the new entry.
        if (!prevTree.scripts.background && tree.scripts.background) {
          console.log(`\n[extro] New background entrypoint detected. Restart \`extro dev\` to pick it up.\n`);
          return;
        }
        if (!prevTree.scripts.content && tree.scripts.content) {
          console.log(`\n[extro] New content entrypoint detected. Restart \`extro dev\` to pick it up.\n`);
          return;
        }
        for (const surface of routableSurfaceList) {
          const had = (prevTree.surfaces[surface]?.length ?? 0) > 0;
          const has = (tree.surfaces[surface]?.length ?? 0) > 0;
          if (has && !had) {
            console.log(`\n[extro] New ${surface} surface detected. Restart \`extro dev\` to pick it up.\n`);
            return;
          }
        }

        // Existing surface gained/lost a route → invalidate that surface's
        // routes virtual module; the runtime module's
        // accept("virtual:extro/routes/<surface>") boundary picks up the
        // new array and calls handle.update without a remount.
        for (const surface of routableSurfaceList) {
          const fileKey = (routes: AppTree["surfaces"][RoutableSurface]) =>
            (routes ?? []).map((r) => r.file).sort().join("|");
          if (fileKey(prevTree.surfaces[surface]) === fileKey(tree.surfaces[surface])) {
            continue;
          }
          const mod = server.moduleGraph.getModuleById(resolved(routesId(surface)));
          if (mod) {
            await server.reloadModule(mod);
            console.log(`[extro] Routes updated for ${surface}.`);
          }
        }
      };

      server.watcher.on("add", handleChange);
      server.watcher.on("unlink", handleChange);
    },

    resolveId(id) {
      if (devBridge && id === DEV_BG_ID) return resolved(DEV_BG_ID);
      if (id === CSUI_CONTENT_ID) return resolved(CSUI_CONTENT_ID);
      if (scriptsOnly) return;
      for (const desc of SURFACES) {
        if (desc.kind !== "routable") continue;
        const surface = desc.name as RoutableSurface;
        if (id === runtimeId(surface)) return resolved(runtimeId(surface));
        if (id === routesId(surface)) return resolved(routesId(surface));
      }
    },

    load(id) {
      if (devBridge && id === resolved(DEV_BG_ID)) {
        return generateDevBridgeModule({
          signalPort: devBridge.signalPort,
          userBackground: tree.scripts.background,
          hasCSUI: !!tree.scripts.content?.csui,
        });
      }
      const content = tree.scripts.content;
      if (id === resolved(CSUI_CONTENT_ID) && content?.csui) {
        return generateCSUIMountModule({
          page: content.csui,
          script: content.script,
          dev: !!devBridge,
        });
      }
      if (scriptsOnly) return;
      for (const desc of SURFACES) {
        if (desc.kind !== "routable") continue;
        const surface = desc.name as RoutableSurface;
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

    handleHotUpdate(ctx) {
      if (!broadcastHmr) return;
      // Mirror Vite's own HMR `update` payload shape. Modules without a
      // resolved url (rare — e.g. virtual-only) are skipped; CSUI re-mount
      // signal still covers those via `scripts-rebuilt`.
      const updates = ctx.modules
        .filter((m) => !!m.url)
        .map((m) => ({
          type: m.type === "css" ? "css-update" : "js-update",
          path: m.url,
          acceptedPath: m.url,
          timestamp: ctx.timestamp,
          explicitImportRequired: false,
          isWithinCircularImport: false,
        }));
      if (updates.length === 0) return;
      broadcastHmr({ type: "update", updates });
    },
  };
}
