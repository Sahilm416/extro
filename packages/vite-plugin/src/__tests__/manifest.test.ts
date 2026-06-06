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
