import fs from "node:fs";
import path from "node:path";
import type { PluginContextLike } from "../types/index.js";
import { PUBLIC_DIR, type PublicAssets } from "../public.js";

interface EmitPublicAssetsOptions {
  ctx: PluginContextLike;
  root: string;
  /** The partitioned Public assets from the Asset inventory. */
  publicAssets: PublicAssets;
}

/**
 * @file generators/public.ts
 * @description Emits Public assets into the build output with their original
 * names, from the partition the Asset inventory already computed. Mirrors
 * `emitIcons`; the collision guard skips any file that would overwrite a
 * generated output and warns instead.
 */
export function emitPublicAssets({ ctx, root, publicAssets }: EmitPublicAssetsOptions) {
  const { files, conflicts } = publicAssets;

  for (const conflict of conflicts) {
    ctx.warn(
      `public/${conflict} collides with a generated output; skipping. Rename it to ship it.`,
    );
  }

  for (const file of files) {
    const source = fs.readFileSync(path.join(root, PUBLIC_DIR, file));
    ctx.emitFile({ type: "asset", fileName: file, source });
  }
}
