import fs from "node:fs";
import path from "node:path";
import type { AppTree } from "./app-tree.js";
import { DEV_PROBE_FILE } from "./generators/html.js";

/**
 * @file public.ts
 * @description Discovers Public assets (static files under the project-root
 * `public/` directory) and partitions them against the names Extro itself
 * emits, so a stray `public/manifest.json` can never shadow the real one.
 * The same partition drives prod emission, dev copy, and the
 * `web_accessible_resources` list, so all three agree on exactly what ships.
 */

export const PUBLIC_DIR = "public";

export interface PublicAssets {
  /** Posix-relative paths that will ship, sorted for stable output. */
  files: string[];
  /** Files skipped because their name collides with a generated output. */
  conflicts: string[];
}

/** Recursively list files under `dir` as posix-relative paths from `base`. */
function walk(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs, base));
    } else {
      out.push(path.relative(base, abs).split(path.sep).join("/"));
    }
  }
  return out;
}

/**
 * Names a Public asset must not overwrite: the generated manifest, the
 * per-surface HTML shells and script bundles, and the dedicated `icons/`
 * tree. Generated output always wins.
 */
function isReservedName(name: string, tree: AppTree): boolean {
  if (name === "manifest.json") return true;
  // Dev-only output, but reserved in all modes so the partition (and the
  // web_accessible_resources list derived from it) doesn't depend on the
  // build mode.
  if (name === DEV_PROBE_FILE) return true;
  if (name === "icons" || name.startsWith("icons/")) return true;
  for (const surface of Object.keys(tree.surfaces)) {
    if (name === `${surface}.html` || name === `${surface}.js`) return true;
  }
  if (tree.scripts.background && name === "background.js") return true;
  if (tree.scripts.content && name === "content.js") return true;
  return false;
}

/**
 * Partition `public/` into shippable files and conflicts. Returns empty
 * lists when `public/` is absent.
 */
export function collectPublicAssets(root: string, tree: AppTree): PublicAssets {
  const dir = path.join(root, PUBLIC_DIR);
  if (!fs.existsSync(dir)) return { files: [], conflicts: [] };

  const files: string[] = [];
  const conflicts: string[] = [];
  for (const rel of walk(dir, dir).sort()) {
    if (isReservedName(rel, tree)) conflicts.push(rel);
    else files.push(rel);
  }
  return { files, conflicts };
}
