import fg from "fast-glob";
import path from "node:path";
import { ExtensionEntry } from "./constants.js";

type ExtensionEntries = Partial<Record<ExtensionEntry, string>>;

export async function findExtensionEntries(root: string) {
  const entries: ExtensionEntries = {};

  const files = await fg(
    [
      "popup/page.{ts,tsx}",
      "background/index.{ts,tsx}",
      "content/index.{ts,tsx}",
      "options/page.{ts,tsx}",
      "sidepanel/page.{ts,tsx}",
    ],
    { cwd: root },
  );

  for (const file of files) {
    const name = file.split("/")[0] as ExtensionEntry;
    entries[name] = path.join(root, file);
  }

  return entries;
}
