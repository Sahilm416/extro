import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "vitest";

import type { ExtroConfig } from "@extrojs/types";
import type { AppTree } from "../app-tree.js";
import { generateManifest } from "../manifest.js";

// A bare project: no icons/, no public/, no surfaces. The fs probes in
// generateManifest (detectIcons, collectPublicAssets) just return empty.
const baseOpts = (config: ExtroConfig = {}) => ({
  tree: { scripts: {}, surfaces: {} } as AppTree,
  root: tmpdir(),
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
