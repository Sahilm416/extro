import fs from "node:fs";
import path from "node:path";
import type { AppTree } from "../app-tree.js";
import type { PluginContextLike } from "../types/index.js";
import { collectPublicAssets, PUBLIC_DIR } from "../public.js";

interface EmitPublicAssetsOptions {
  ctx: PluginContextLike;
  root: string;
  tree: AppTree;
}

/**
 * @file generators/public.ts
 * @description Emits Public assets into the build output with their original
 * names. Mirrors `emitIcons`; the collision guard skips any file that would
 * overwrite a generated output and warns instead.
 */
export function emitPublicAssets({ ctx, root, tree }: EmitPublicAssetsOptions) {
  const { files, conflicts } = collectPublicAssets(root, tree);

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
