import path from "node:path";

import type { Plugin } from "vite";
import type { ExtroConfig } from "@extrojs/types";

import {
  scanAppTree,
  routeManifest,
  APP_FILE_BASENAMES,
  type AppTree,
} from "./app-tree.js";
import { emitAssets } from "./emit-assets.js";
import { SURFACES, type RoutableSurface } from "./surfaces.js";

import { emitIcons } from "./generators/icons.js";
import { emitPublicAssets } from "./generators/public.js";

import { emit } from "./runtimes/routes-module.js";
import { generateRuntimeModule } from "./runtimes/runtime-module.js";
import {
  DEV_BRIDGE_ENTRY_ID,
  DEV_BRIDGE_CONFIG_ID,
  DEV_BRIDGE_USER_BG_ID,
  loadDevBridgeClient,
  devBridgeConfigSource,
  devBridgeUserBackgroundSource,
} from "./runtimes/dev-bridge.js";
import {
  CSUI_ENTRY_ID,
  CSUI_CONFIG_ID,
  CSUI_USER_PAGE_ID,
  CSUI_USER_SCRIPT_ID,
  loadCSUIClient,
  csuiConfigSource,
  csuiUserPageSource,
  csuiUserScriptSource,
} from "./runtimes/csui-mount.js";

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
  devBridge?: { signalPort: number; vitePort: number };
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
        ? CSUI_ENTRY_ID
        : tree.scripts.content?.script;

      if (devBridge) {
        // Force a background entry in dev — wraps user's BG (if any) with
        // the WS bridge.
        input.background = DEV_BRIDGE_ENTRY_ID;
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
        // Extro owns `public/` emission through its own pipeline (collision
        // guard + WAR list + dev-output parity), so Vite's native copy is
        // off. See ADR 0004.
        publicDir: false,
        // Only EXTRO_PUBLIC_* is inlined into surfaces via import.meta.env.
        // Exactly EXTRO_PUBLIC_, never EXTRO_ (that would leak EXTRO_CRX_KEY
        // and other build-time vars into bundles). See ADR 0002.
        envPrefix: "EXTRO_PUBLIC_",
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
      emitPublicAssets({ ctx: this, root, tree });
    },

    configureServer(server) {
      if (scriptsOnly) return;

      const basenames = APP_FILE_BASENAMES.join(",");
      server.watcher.add(
        path.join(root, `src/app/**/{${basenames}}.{ts,tsx}`),
      );

      // Warm the CSUI module into the dev server's module graph so its
      // transitive imports are tracked too. Without this, content files
      // never appear in handleHotUpdate's ctx.modules (the dev server
      // only owns the routable surfaces — popup / options / sidepanel —
      // as Rollup inputs), so edits under src/app/content/ would never
      // produce an HMR payload for the BG-fetch RFR transport.
      const csui = tree.scripts.content?.csui;
      if (csui && broadcastHmr) {
        const url = "/" + path.relative(root, csui).split(path.sep).join("/");
        server.warmupRequest(url).catch(() => {});
      }

      // Same source as the scanner glob — see APP_FILE_BASENAMES.
      const isAppEntry = new RegExp(
        `^src/app/[^/]+/(?:.+/)?(?:${APP_FILE_BASENAMES.join("|")})\\.tsx?$`,
      );
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
          const had = (prevTree.surfaces[surface]?.routes.length ?? 0) > 0;
          const has = (tree.surfaces[surface]?.routes.length ?? 0) > 0;
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
          // The Route manifest IS what the routes module emits, and it is
          // fully serializable, so its stable stringify is a faithful
          // identity — invalidation can no longer drift from the contract
          // (ADR 0005). This is what kills the historical HMR-drift bug class.
          const key = (t: AppTree) =>
            JSON.stringify(routeManifest(t, surface));
          if (key(prevTree) === key(tree)) {
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
      // Dev bridge virtuals
      if (devBridge && id === DEV_BRIDGE_ENTRY_ID) return resolved(DEV_BRIDGE_ENTRY_ID);
      if (devBridge && id === DEV_BRIDGE_CONFIG_ID) return resolved(DEV_BRIDGE_CONFIG_ID);
      if (devBridge && id === DEV_BRIDGE_USER_BG_ID) return resolved(DEV_BRIDGE_USER_BG_ID);
      // CSUI virtuals
      if (id === CSUI_ENTRY_ID) return resolved(CSUI_ENTRY_ID);
      if (id === CSUI_CONFIG_ID) return resolved(CSUI_CONFIG_ID);
      if (id === CSUI_USER_PAGE_ID) return resolved(CSUI_USER_PAGE_ID);
      if (id === CSUI_USER_SCRIPT_ID) return resolved(CSUI_USER_SCRIPT_ID);
      if (scriptsOnly) return;
      for (const desc of SURFACES) {
        if (desc.kind !== "routable") continue;
        const surface = desc.name as RoutableSurface;
        if (id === runtimeId(surface)) return resolved(runtimeId(surface));
        if (id === routesId(surface)) return resolved(routesId(surface));
      }
    },

    load(id) {
      // Dev bridge: entry + its config + the optional user-background re-export.
      if (devBridge && id === resolved(DEV_BRIDGE_ENTRY_ID)) {
        return loadDevBridgeClient();
      }
      if (devBridge && id === resolved(DEV_BRIDGE_CONFIG_ID)) {
        return devBridgeConfigSource({
          signalPort: devBridge.signalPort,
          vitePort: devBridge.vitePort,
          hasCSUI: !!tree.scripts.content?.csui,
        });
      }
      if (devBridge && id === resolved(DEV_BRIDGE_USER_BG_ID)) {
        return devBridgeUserBackgroundSource(tree.scripts.background);
      }

      // CSUI mount: entry + its config + the user page + optional side-effect script.
      const content = tree.scripts.content;
      if (id === resolved(CSUI_ENTRY_ID) && content?.csui) {
        return loadCSUIClient();
      }
      if (id === resolved(CSUI_CONFIG_ID)) {
        return csuiConfigSource(!!devBridge);
      }
      if (id === resolved(CSUI_USER_PAGE_ID) && content?.csui) {
        return csuiUserPageSource(content.csui);
      }
      if (id === resolved(CSUI_USER_SCRIPT_ID)) {
        return csuiUserScriptSource(content?.script);
      }

      if (scriptsOnly) return;
      for (const desc of SURFACES) {
        if (desc.kind !== "routable") continue;
        const surface = desc.name as RoutableSurface;
        if (id === resolved(runtimeId(surface))) {
          return generateRuntimeModule({ surface });
        }
        if (id === resolved(routesId(surface))) {
          return emit(routeManifest(tree, surface));
        }
      }
    },

    handleHotUpdate(ctx) {
      if (!broadcastHmr) return;
      // Mirror Vite's own HMR `update` payload shape. Modules without a
      // resolved url (rare — e.g. virtual-only) are skipped; the CSUI
      // re-mount signal still covers those via `cs-rebuilt`. Content
      // files reach this list naturally because configureServer warms the
      // CSUI module into the graph at startup.
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
