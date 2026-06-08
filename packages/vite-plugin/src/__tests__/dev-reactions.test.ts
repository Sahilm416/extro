import { describe, it, expect } from "vitest";

import type { ManifestRoute, RouteManifest } from "@extrojs/types";
import type { AppTree } from "../app-tree.js";
import type { RoutableSurface } from "../surfaces.js";
import {
  classifyScriptChange,
  mergeDirty,
  resolveFlush,
  decideTreeReaction,
} from "../dev-reactions.js";

const ROUTABLES: readonly RoutableSurface[] = ["popup", "options", "sidepanel"];

const route = (path: string): ManifestRoute => ({
  type: "static",
  path,
  file: `app/popup${path}/page.tsx`,
  boundaries: [],
});

const manifest = (paths: string[]): RouteManifest => ({
  routes: paths.map(route),
  notFound: null,
  rootLayout: null,
});

const tree = (parts: Partial<AppTree> = {}): AppTree => ({
  scripts: {},
  surfaces: {},
  ...parts,
});

describe("classifyScriptChange", () => {
  it("dirties background for a file under src/app/background/", () => {
    expect(classifyScriptChange("/p/src/app/background/index.ts")).toEqual({
      background: true,
      content: false,
    });
  });

  it("dirties content for a file under src/app/content/", () => {
    expect(classifyScriptChange("/p/src/app/content/index.ts")).toEqual({
      background: false,
      content: true,
    });
  });

  it("dirties both for shared code outside either surface dir", () => {
    expect(classifyScriptChange("/p/src/lib/util.ts")).toEqual({
      background: true,
      content: true,
    });
  });

  it("normalizes windows separators", () => {
    expect(classifyScriptChange("C:\\p\\src\\app\\content\\index.ts")).toEqual({
      background: false,
      content: true,
    });
  });
});

describe("mergeDirty", () => {
  it("unions the two states", () => {
    expect(
      mergeDirty({ background: true, content: false }, { background: false, content: true }),
    ).toEqual({ background: true, content: true });
  });
});

describe("resolveFlush", () => {
  it("treats an empty accumulation as both (initial build / restart)", () => {
    expect(resolveFlush({ background: false, content: false })).toEqual({
      background: true,
      content: true,
    });
  });

  it("passes a non-empty accumulation through unchanged", () => {
    expect(resolveFlush({ background: true, content: false })).toEqual({
      background: true,
      content: false,
    });
  });
});

describe("decideTreeReaction", () => {
  it("restarts when a background entry is born mid-session", () => {
    const next = tree({ scripts: { background: "/abs/bg.ts" } });
    expect(decideTreeReaction(tree(), next, ROUTABLES)).toEqual({
      kind: "restart",
      surface: "background",
    });
  });

  it("restarts when a content entry is born mid-session", () => {
    const next = tree({ scripts: { content: { script: "/abs/c.ts" } } });
    expect(decideTreeReaction(tree(), next, ROUTABLES)).toEqual({
      kind: "restart",
      surface: "content",
    });
  });

  it("restarts when a Routable surface is born", () => {
    const next = tree({ surfaces: { popup: manifest(["/"]) } });
    expect(decideTreeReaction(tree(), next, ROUTABLES)).toEqual({
      kind: "restart",
      surface: "popup",
    });
  });

  it("invalidates a surface that gained a Route", () => {
    const prev = tree({ surfaces: { popup: manifest(["/"]) } });
    const next = tree({ surfaces: { popup: manifest(["/", "/settings"]) } });
    expect(decideTreeReaction(prev, next, ROUTABLES)).toEqual({
      kind: "invalidate",
      surfaces: ["popup"],
    });
  });

  it("invalidates every surface whose Route manifest changed", () => {
    const prev = tree({
      surfaces: { popup: manifest(["/"]), options: manifest(["/about"]) },
    });
    const next = tree({
      surfaces: { popup: manifest(["/", "/x"]), options: manifest(["/contact"]) },
    });
    expect(decideTreeReaction(prev, next, ROUTABLES)).toEqual({
      kind: "invalidate",
      surfaces: ["popup", "options"],
    });
  });

  it("noops when nothing actionable changed", () => {
    const same = tree({ surfaces: { popup: manifest(["/"]) } });
    expect(decideTreeReaction(same, same, ROUTABLES)).toEqual({ kind: "noop" });
  });

  it("lets a birth short-circuit an invalidate in the same change", () => {
    const prev = tree({ surfaces: { popup: manifest(["/"]) } });
    const next = tree({
      scripts: { background: "/abs/bg.ts" },
      surfaces: { popup: manifest(["/", "/x"]) },
    });
    expect(decideTreeReaction(prev, next, ROUTABLES)).toEqual({
      kind: "restart",
      surface: "background",
    });
  });
});
