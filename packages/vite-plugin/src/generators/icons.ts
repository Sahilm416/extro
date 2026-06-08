import fs from "node:fs";
import path from "node:path";
import type { PluginContextLike } from "../types/index.js";

interface EmitIconsOptions {
  ctx: PluginContextLike;
  root: string;
  /** The recognized icon set from the Asset inventory (size -> "icons/16.png"). */
  icons: Record<string, string> | null;
}

/**
 * @file generators/icons.ts
 * @description Emits the recognized extension icons named by the Asset
 * inventory. Discovery already decided which sizes exist, so this only reads
 * bytes: what ships is exactly what `manifest.icons` references.
 */
export function emitIcons({ ctx, root, icons }: EmitIconsOptions) {
  if (!icons) return;

  for (const rel of Object.values(icons)) {
    const source = fs.readFileSync(path.join(root, rel));
    ctx.emitFile({ type: "asset", fileName: rel, source });
  }
}
