import { describe, it, expect, afterEach } from "vitest";

import type { ExtroConfig } from "../../types/index.js";
import type { AppTree } from "../app-tree.js";
import type { AssetInventory } from "../asset-inventory.js";
import { generateManifest } from "../manifest.js";

const EMPTY_INVENTORY: AssetInventory = {
  icons: null,
  public: { files: [], conflicts: [] },
};

// A bare project: no icons, no Public assets, no surfaces. generateManifest is
// pure over (tree, inventory, config), so the inventory is just hand-built
// data — no filesystem, no tmpdir.
const baseOpts = (
  config: ExtroConfig = {},
  inventory: AssetInventory = EMPTY_INVENTORY,
) => ({
  tree: { scripts: {}, surfaces: {} } as AppTree,
  inventory,
  pkg: { name: "x", version: "1.0.0" },
  config,
});

const prev = process.env.EXTRO_CRX_KEY;
afterEach(() => {
  if (prev === undefined) delete process.env.EXTRO_CRX_KEY;
  else process.env.EXTRO_CRX_KEY = prev;
});

describe("manifest CRX key (ADR 0002)", () => {
  it("maps EXTRO_CRX_KEY to manifest.key", () => {
    process.env.EXTRO_CRX_KEY = "MIIBPUBLICKEY";
    expect(generateManifest(baseOpts()).key).toBe("MIIBPUBLICKEY");
  });

  it("leaves key unset when EXTRO_CRX_KEY is absent", () => {
    delete process.env.EXTRO_CRX_KEY;
    expect(generateManifest(baseOpts()).key).toBeUndefined();
  });

  it("lets an explicit config.manifest.key win over the env value", () => {
    process.env.EXTRO_CRX_KEY = "FROM_ENV";
    const manifest = generateManifest(baseOpts({ manifest: { key: "FROM_CONFIG" } }));
    expect(manifest.key).toBe("FROM_CONFIG");
  });
});

describe("transformManifest (ADR 0008)", () => {
  it("applies a mutation made in place", () => {
    const manifest = generateManifest(
      baseOpts({
        transformManifest(m) {
          m.minimum_chrome_version = "114";
        },
      }),
    );
    expect(manifest.minimum_chrome_version).toBe("114");
  });

  it("uses a returned replacement manifest", () => {
    const manifest = generateManifest(
      baseOpts({
        transformManifest: () => ({ manifest_version: 3, name: "Replaced", version: "9.9.9" }),
      }),
    );
    expect(manifest.name).toBe("Replaced");
    expect(manifest.version).toBe("9.9.9");
  });

  it("runs after the config.manifest merge and the CRX key", () => {
    process.env.EXTRO_CRX_KEY = "FROM_ENV";
    const manifest = generateManifest(
      baseOpts({
        manifest: { description: "from manifest" },
        transformManifest(m) {
          // sees both the static merge and the CRX key
          expect(m.description).toBe("from manifest");
          expect(m.key).toBe("FROM_ENV");
          m.description = "from transform";
        },
      }),
    );
    expect(manifest.description).toBe("from transform");
  });
});

describe("asset inventory consumption (candidate 1)", () => {
  it("writes the inventory's recognized icons to manifest.icons", () => {
    const inventory: AssetInventory = {
      icons: { "16": "icons/16.png", "48": "icons/48.png" },
      public: { files: [], conflicts: [] },
    };
    expect(generateManifest(baseOpts({}, inventory)).icons).toEqual({
      "16": "icons/16.png",
      "48": "icons/48.png",
    });
  });

  it("reflects exactly the inventory's icon set (the reconcile lives in discovery)", () => {
    // A stray size never reaches the inventory, so it can never reach the
    // manifest: manifest.icons and the emitted files share one source.
    const inventory: AssetInventory = {
      icons: { "16": "icons/16.png" },
      public: { files: [], conflicts: [] },
    };
    expect(Object.keys(generateManifest(baseOpts({}, inventory)).icons ?? {})).toEqual(["16"]);
  });

  it("lets config.icons win over the inventory", () => {
    const inventory: AssetInventory = {
      icons: { "16": "icons/16.png" },
      public: { files: [], conflicts: [] },
    };
    const manifest = generateManifest(
      baseOpts({ icons: { "128": "brand/128.png" } }, inventory),
    );
    expect(manifest.icons).toEqual({ "128": "brand/128.png" });
  });

  it("leaves manifest.icons unset when the inventory has none", () => {
    expect(generateManifest(baseOpts()).icons).toBeUndefined();
  });

  it("lists Public assets in web_accessible_resources when a Content surface is present", () => {
    const tree = {
      scripts: { content: { script: "/abs/content.ts" } },
      surfaces: {},
    } as unknown as AppTree;
    const inventory: AssetInventory = {
      icons: null,
      public: { files: ["logo.png", "img/a.png"], conflicts: [] },
    };
    const manifest = generateManifest({
      tree,
      inventory,
      pkg: { name: "x", version: "1.0.0" },
      config: {},
    });
    expect(manifest.web_accessible_resources).toEqual([
      { resources: ["logo.png", "img/a.png"], matches: ["<all_urls>"] },
    ]);
  });

  it("registers no web_accessible_resources for Public assets without a Content surface", () => {
    const inventory: AssetInventory = {
      icons: null,
      public: { files: ["logo.png"], conflicts: [] },
    };
    const manifest = generateManifest(baseOpts({}, inventory));
    expect(manifest.web_accessible_resources).toBeUndefined();
  });
});
