import type { ExtroConfig, ManifestV3 } from "../types/index.js";
import type { AppTree } from "./app-tree.js";

// ---------------------------------------------------------------------------
// Surface name unions
// ---------------------------------------------------------------------------

export type RoutableSurface = "popup" | "options" | "sidepanel";
export type ScriptSurface = "background" | "content";
export type SurfaceName = RoutableSurface | ScriptSurface;
export type SurfaceKind = "routable" | "script";

// ---------------------------------------------------------------------------
// Build context passed to every descriptor method
// ---------------------------------------------------------------------------

export interface SurfaceContext {
  tree: AppTree;
  config: ExtroConfig;
  /** Set during `extro dev` so descriptors can adjust for dev-mode behavior. */
  dev?: { port: number; signalPort: number };
  /**
   * Shippable Public asset paths (posix, relative to `public/`). Computed once
   * in `generateManifest` so descriptors stay pure. The Content descriptor
   * lists them in `web_accessible_resources`.
   */
  publicAssets?: string[];
}

// ---------------------------------------------------------------------------
// Descriptor — every surface declares everything it knows about itself here
// ---------------------------------------------------------------------------

export interface SurfaceDescriptor {
  name: SurfaceName;
  kind: SurfaceKind;
  /** Whether this surface is materialized for the current build. */
  isPresent: (ctx: SurfaceContext) => boolean;
  /** Manifest fragment merged into the final manifest when present. */
  manifestContribution: (ctx: SurfaceContext) => Partial<ManifestV3>;
  /** Permissions added when present and the user hasn't supplied their own list. */
  permissions?: (ctx: SurfaceContext) => readonly string[];
  /** Host permissions added when present and the user hasn't supplied their own list. */
  hostPermissions?: (ctx: SurfaceContext) => readonly string[];
  /** Content surface flag: also accept `page.tsx` as the CSUI Mode. */
  acceptsCsuiPage?: boolean;
}

export const SURFACES: readonly SurfaceDescriptor[] = [
  {
    name: "popup",
    kind: "routable",
    isPresent: ({ tree }) => !!tree.surfaces.popup,
    manifestContribution: () => ({ action: { default_popup: "popup.html" } }),
  },
  {
    name: "options",
    kind: "routable",
    isPresent: ({ tree }) => !!tree.surfaces.options,
    manifestContribution: () => ({
      options_ui: { page: "options.html", open_in_tab: true },
    }),
  },
  {
    name: "sidepanel",
    kind: "routable",
    isPresent: ({ tree }) => !!tree.surfaces.sidepanel,
    manifestContribution: () => ({ side_panel: { default_path: "sidepanel.html" } }),
  },
  {
    name: "background",
    kind: "script",
    // In dev the bridge runs as the background SW even when the user has
    // no BG file, so the surface is forced present.
    isPresent: ({ tree, dev }) => !!tree.scripts.background || !!dev,
    manifestContribution: () => ({
      background: { service_worker: "background.js" },
    }),
    // `tabs` is added in dev so the bridge can call chrome.tabs.reload.
    permissions: ({ dev }) => (dev ? ["storage", "tabs"] : ["storage"]),
  },
  {
    name: "content",
    kind: "script",
    acceptsCsuiPage: true,
    isPresent: ({ tree }) => !!tree.scripts.content,
    manifestContribution: ({ tree, config, publicAssets }) => {
      const matches = config.content?.matches ?? ["<all_urls>"];
      const fragment: Partial<ManifestV3> = {
        content_scripts: [{ matches, js: ["content.js"] }],
      };
      // Anything a content script reaches via chrome.runtime.getURL must be
      // declared accessible. The CSUI mount runtime dynamic-imports
      // content.js; Public assets are getURL'd by user code. Both ride one
      // entry scoped to the content script's matches.
      const resources: string[] = [];
      if (tree.scripts.content?.csui) resources.push("content.js");
      if (publicAssets?.length) resources.push(...publicAssets);
      if (resources.length) {
        fragment.web_accessible_resources = [{ resources, matches }];
      }
      return fragment;
    },
    hostPermissions: ({ config }) => config.content?.matches ?? ["<all_urls>"],
  },
];

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const BY_NAME = new Map<string, SurfaceDescriptor>(
  SURFACES.map((s) => [s.name, s]),
);

export function findSurface(name: string): SurfaceDescriptor | undefined {
  return BY_NAME.get(name);
}
