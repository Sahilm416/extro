import fs from "node:fs";
import path from "node:path";
import type { PluginContextLike } from "../types/index.js";

interface GenerateIconsOptions {
  ctx: PluginContextLike;
  root: string;
}

/**
 * @file generators/icons.ts
 * @description Generates the icons for the extension.
 */
export function emitIcons({ ctx, root }: GenerateIconsOptions) {
  const iconsDir = path.join(root, "icons");

  if (!fs.existsSync(iconsDir)) return;

  const files = fs.readdirSync(iconsDir);

  for (const file of files) {
    const source = fs.readFileSync(path.join(iconsDir, file));

    ctx.emitFile({
      type: "asset",
      fileName: `icons/${file}`,
      source,
    });
  }
}
