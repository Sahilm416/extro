import fs from "node:fs";
import path from "node:path";

export function detectIcons(root: string) {
  const iconsDir = path.join(root, "icons");

  if (!fs.existsSync(iconsDir)) return undefined;

  const sizes = ["16", "32", "48", "128"];
  const icons: Record<string, string> = {};

  for (const size of sizes) {
    const file = path.join(iconsDir, `${size}.png`);
    if (fs.existsSync(file)) {
      icons[size] = `icons/${size}.png`;
    }
  }

  return Object.keys(icons).length ? icons : undefined;
}
