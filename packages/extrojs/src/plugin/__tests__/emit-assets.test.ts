import { describe, it, expect } from "vitest";

import type { AppTree } from "../app-tree.js";
import type { AssetInventory } from "../asset-inventory.js";
import { composeArtifacts, emitAssets } from "../emit-assets.js";
import { DEV_PROBE_FILE } from "../generators/html.js";

const EMPTY_INVENTORY: AssetInventory = {
  icons: null,
  public: { files: [], conflicts: [] },
};

const popupTree = (): AppTree => ({
  scripts: {},
  surfaces: { popup: { routes: [], notFound: null, rootLayout: null } },
});

const baseOpts = (
  tree: AppTree,
  dev?: { port: number; signalPort: number },
) => ({
  tree,
  inventory: EMPTY_INVENTORY,
  pkg: { name: "x", version: "1.0.0" },
  config: {},
  dev,
});

const DEV = { port: 5173, signalPort: 5174 };

describe("dev shell offline screen", () => {
  it("ships the screen hidden, with the probe ahead of the dev-server scripts", () => {
    const { html } = composeArtifacts(baseOpts(popupTree(), DEV));
    const shell = html.popup!;

    // Hidden until the probe proves the server is down — a normal start
    // must never paint it (the flash this guards against).
    expect(shell).toContain(`<div class="extro-dev-screen" hidden>`);

    const probeAt = shell.indexOf(`./${DEV_PROBE_FILE}`);
    expect(probeAt).toBeGreaterThan(-1);
    expect(probeAt).toBeLessThan(shell.indexOf("@vite/client"));
  });

  it("composes a probe keyed to @vite/client at the dev port", () => {
    const { devProbe } = composeArtifacts(baseOpts(popupTree(), DEV));
    expect(devProbe).toContain("http://localhost:5173/@vite/client");
  });

  it("composes no probe and no screen in prod", () => {
    const { devProbe, html } = composeArtifacts(baseOpts(popupTree()));
    expect(devProbe).toBeUndefined();
    expect(html.popup).not.toContain("extro-dev-screen");
  });

  it("composes no probe when there are no HTML surfaces", () => {
    const tree: AppTree = { scripts: { background: "/abs/bg.ts" }, surfaces: {} };
    expect(composeArtifacts(baseOpts(tree, DEV)).devProbe).toBeUndefined();
  });
});

describe("emitAssets", () => {
  it("emits the probe alongside the shells in dev", async () => {
    const written: string[] = [];
    await emitAssets(baseOpts(popupTree(), DEV), (fileName) => {
      written.push(fileName);
    });
    expect(written).toContain(DEV_PROBE_FILE);
    expect(written).toContain("popup.html");
  });

  it("does not emit the probe in prod", async () => {
    const written: string[] = [];
    await emitAssets(baseOpts(popupTree()), (fileName) => {
      written.push(fileName);
    });
    expect(written).not.toContain(DEV_PROBE_FILE);
  });
});
