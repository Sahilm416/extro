import fg from "fast-glob";
import path from "node:path";
import { ExtensionEntry } from "./constants.js";

type ExtensionEntries = Partial<Record<ExtensionEntry, string>>;

export async function findExtensionEntries(root: string) {
  const entries: ExtensionEntries = {};

  const files = await fg(
    [
      "src/app/popup/page.{ts,tsx}",
      "src/app/options/page.{ts,tsx}",
      "src/app/sidepanel/page.{ts,tsx}",
      "src/app/background/index.{ts,tsx}",
      "src/app/content/index.{ts,tsx}",
    ],
    { cwd: root },
  );

  for (const file of files) {
    if (file.startsWith("src/app/popup/")) {
      entries.popup = path.join(root, file);
    } else if (file.startsWith("src/app/options/")) {
      entries.options = path.join(root, file);
    } else if (file.startsWith("src/app/sidepanel/")) {
      entries.sidepanel = path.join(root, file);
    } else if (file.startsWith("src/app/background/")) {
      entries.background = path.join(root, file);
    } else if (file.startsWith("src/app/content/")) {
      entries.content = path.join(root, file);
    }
  }

  return entries;
}
