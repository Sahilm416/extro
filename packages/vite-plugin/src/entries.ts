import fg from "fast-glob";
import path from "node:path";
import { ExtensionEntry } from "./constants.js";

type ExtensionEntries = Partial<Record<ExtensionEntry, string>>;

export async function findExtensionEntries(root: string) {
  const entries: ExtensionEntries = {};

  const files = await fg(
    [
      "src/ext/background/index.{ts,tsx}",
      "src/ext/content/index.{ts,tsx}",
      "src/ext/options/page.{ts,tsx}",
      "src/ext/sidepanel/page.{ts,tsx}",
      "src/page.{ts,tsx}",
    ],
    { cwd: root },
  );

  for (const file of files) {
    if (file.startsWith("src/ext/background")) {
      entries.background = path.join(root, file);
    } else if (file.startsWith("src/ext/content")) {
      entries.content = path.join(root, file);
    } else if (file.startsWith("src/ext/options")) {
      entries.options = path.join(root, file);
    } else if (file.startsWith("src/ext/sidepanel")) {
      entries.sidepanel = path.join(root, file);
    } else if (file.startsWith("src/page")) {
      entries.popup = path.join(root, file);
    }
  }

  return entries;
}
