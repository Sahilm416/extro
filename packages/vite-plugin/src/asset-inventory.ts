import type { AppTree } from "./app-tree.js";
import { detectIcons } from "./icons.js";
import { collectPublicAssets, type PublicAssets } from "./public.js";

/**
 * @file asset-inventory.ts
 * @description The Asset inventory: the discovered static-file inputs a build
 * ships. One `discoverAssets(root, tree)` pass over `icons/` and `public/`
 * yields a value consumed by both the Manifest generator (kept pure, taking
 * this as data) and the emit/copy paths, so the filesystem is walked once per
 * build instead of three times.
 *
 * The icon set here is the recognized-sizes set (16/32/48/128) that
 * `manifest.icons` references, and it is exactly what the emit/copy paths ship.
 * A stray `icons/64.png` is not in the inventory, so it never ships: there is
 * one notion of "an icon", and `manifest.icons` and the emitted icon files
 * cannot diverge.
 */
export interface AssetInventory {
  /** Recognized icons: size -> output path ("icons/16.png"). null when absent. */
  icons: Record<string, string> | null;
  /** Public assets, partitioned against the names a build generates. */
  public: PublicAssets;
}

/** Walk `icons/` + `public/` once and return the build's Asset inventory. */
export function discoverAssets(root: string, tree: AppTree): AssetInventory {
  return {
    icons: detectIcons(root) ?? null,
    public: collectPublicAssets(root, tree),
  };
}
