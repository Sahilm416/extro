import type { ManifestV3 } from "@extro/types";
import type { AppTree } from "./app-tree.js";

// ---------------------------------------------------------------------------
// Surface name unions
// ---------------------------------------------------------------------------

const ROUTABLE_NAMES = ["popup", "options", "sidepanel"] as const;
const SCRIPT_NAMES = ["background", "content"] as const;

export type RoutableSurface = (typeof ROUTABLE_NAMES)[number];
export type ScriptSurface = (typeof SCRIPT_NAMES)[number];
export type SurfaceName = RoutableSurface | ScriptSurface;
export type SurfaceKind = "routable" | "script";

export const ROUTABLE_SURFACES: readonly RoutableSurface[] = ROUTABLE_NAMES;
export const SCRIPT_SURFACES: readonly ScriptSurface[] = SCRIPT_NAMES;
export const ALL_SURFACES: readonly SurfaceName[] = [
  ...ROUTABLE_NAMES,
  ...SCRIPT_NAMES,
];

// ---------------------------------------------------------------------------
// Descriptor — every surface declares everything it knows about itself here
// ---------------------------------------------------------------------------

export interface SurfaceDescriptor {
  name: SurfaceName;
  kind: SurfaceKind;
  /** Whether this surface is materialized in the user's app tree. */
  isPresent: (tree: AppTree) => boolean;
  /** Manifest fragment merged into the final manifest when the surface is present. */
  manifestContribution: Partial<ManifestV3>;
  /** Permissions added when present and the user hasn't supplied their own list. */
  defaultPermissions?: readonly string[];
  /** Host permissions added when present and the user hasn't supplied their own list. */
  defaultHostPermissions?: readonly string[];
}

export const SURFACES: readonly SurfaceDescriptor[] = [
  {
    name: "popup",
    kind: "routable",
    isPresent: (tree) => !!tree.surfaces.popup,
    manifestContribution: { action: { default_popup: "popup.html" } },
  },
  {
    name: "options",
    kind: "routable",
    isPresent: (tree) => !!tree.surfaces.options,
    manifestContribution: {
      options_ui: { page: "options.html", open_in_tab: true },
    },
  },
  {
    name: "sidepanel",
    kind: "routable",
    isPresent: (tree) => !!tree.surfaces.sidepanel,
    manifestContribution: { side_panel: { default_path: "sidepanel.html" } },
  },
  {
    name: "background",
    kind: "script",
    isPresent: (tree) => !!tree.scripts.background,
    manifestContribution: { background: { service_worker: "background.js" } },
    defaultPermissions: ["storage"],
  },
  {
    name: "content",
    kind: "script",
    // CSUI (content/page.tsx) without an index.tsx still needs a content
    // script registered — the synthesized bundle carries the mount runtime.
    isPresent: (tree) => !!tree.scripts.content || !!tree.csui,
    manifestContribution: {
      content_scripts: [{ matches: ["<all_urls>"], js: ["content.js"] }],
    },
    defaultHostPermissions: ["<all_urls>"],
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
