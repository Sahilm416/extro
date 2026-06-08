import fs from "node:fs";
import path from "node:path";

export function readJson<T = unknown>(file: string, root: string): T | null {
  const filePath = path.join(root, file);

  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
