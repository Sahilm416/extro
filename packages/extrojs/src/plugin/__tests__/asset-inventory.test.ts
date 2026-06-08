import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, it, expect, afterAll } from "vitest";

import type { AppTree } from "../app-tree.js";
import { discoverAssets } from "../asset-inventory.js";

// discoverAssets is the one module that touches the filesystem for assets, so
// it is the one place that stages files on disk. generateManifest and the
// emit/copy paths take its result as data and need no tmpdir.
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const makeRoot = (files: Record<string, string>): string => {
  const root = mkdtempSync(path.join(tmpdir(), "extro-inv-"));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
};

const emptyTree = (): AppTree => ({ scripts: {}, surfaces: {} });

describe("discoverAssets", () => {
  it("returns an empty inventory when icons/ and public/ are absent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "extro-inv-"));
    roots.push(root);
    expect(discoverAssets(root, emptyTree())).toEqual({
      icons: null,
      public: { files: [], conflicts: [] },
    });
  });

  it("recognizes only the canonical icon sizes (the reconcile)", () => {
    // 64.png would have shipped under the old whole-dir readdir; it is not a
    // recognized size, so it is simply absent from the inventory and never
    // ships. manifest.icons and the emitted files cannot diverge.
    const root = makeRoot({
      "icons/16.png": "x",
      "icons/48.png": "x",
      "icons/64.png": "x",
    });
    expect(discoverAssets(root, emptyTree()).icons).toEqual({
      "16": "icons/16.png",
      "48": "icons/48.png",
    });
  });

  it("partitions Public assets against reserved generated names", () => {
    const root = makeRoot({
      "public/logo.png": "x",
      "public/manifest.json": "{}",
    });
    expect(discoverAssets(root, emptyTree()).public).toEqual({
      files: ["logo.png"],
      conflicts: ["manifest.json"],
    });
  });
});
