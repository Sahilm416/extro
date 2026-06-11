import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, it, expect, afterAll } from "vitest";

import type { AppTree } from "../app-tree.js";
import { collectPublicAssets } from "../public.js";

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** Build a project root with the given files under `public/`. */
const makeRoot = (files: Record<string, string>): string => {
  const root = mkdtempSync(path.join(tmpdir(), "extro-pub-"));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, "public", rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
};

const tree = (overrides: Partial<AppTree> = {}): AppTree => ({
  scripts: {},
  surfaces: {},
  ...overrides,
});

describe("collectPublicAssets", () => {
  it("returns empty lists when public/ is absent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "extro-pub-"));
    roots.push(root);
    expect(collectPublicAssets(root, tree())).toEqual({ files: [], conflicts: [] });
  });

  it("walks recursively, returns posix paths, sorted", () => {
    const root = makeRoot({
      "logo.svg": "<svg/>",
      "img/a.png": "x",
      "data.json": "{}",
    });
    expect(collectPublicAssets(root, tree()).files).toEqual([
      "data.json",
      "img/a.png",
      "logo.svg",
    ]);
  });

  it("routes names that collide with generated output into conflicts", () => {
    const root = makeRoot({
      "logo.svg": "<svg/>",
      "manifest.json": "{}",
      "popup.html": "<html/>",
      "icons/16.png": "x",
    });
    const t = tree({
      scripts: { content: { script: "/abs/content.ts" } },
      surfaces: { popup: { routes: [] } as unknown as AppTree["surfaces"]["popup"] },
    });
    const { files, conflicts } = collectPublicAssets(root, t);
    expect(files).toEqual(["logo.svg"]);
    expect(conflicts).toEqual(["icons/16.png", "manifest.json", "popup.html"]);
  });

  it("reserves the dev probe name (extro-dev.js) regardless of build mode", () => {
    const root = makeRoot({ "extro-dev.js": "x", "ok.js": "x" });
    const { files, conflicts } = collectPublicAssets(root, tree());
    expect(files).toEqual(["ok.js"]);
    expect(conflicts).toEqual(["extro-dev.js"]);
  });

  it("reserves the surface bundle name (popup.js)", () => {
    const root = makeRoot({ "popup.js": "x", "ok.js": "x" });
    const t = tree({
      surfaces: { popup: { routes: [] } as unknown as AppTree["surfaces"]["popup"] },
    });
    const { files, conflicts } = collectPublicAssets(root, t);
    expect(files).toEqual(["ok.js"]);
    expect(conflicts).toEqual(["popup.js"]);
  });
});
