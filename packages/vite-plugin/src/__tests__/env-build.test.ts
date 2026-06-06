import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, it, expect, afterAll } from "vitest";
import { build as viteBuild } from "vite";

import { extro } from "../index.js";

// Real builds: assert what actually lands in the emitted bundle. Guards the
// envPrefix inlining boundary and the dev sidecar mode (ADR 0002), neither of
// which a pure unit test can observe.

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** Minimal project: one background script that reads env, plus the given .env files. */
const scaffold = (envFiles: Record<string, string>): string => {
  const root = mkdtempSync(path.join(tmpdir(), "extro-envbuild-"));
  roots.push(root);
  mkdirSync(path.join(root, "src/app/background"), { recursive: true });
  writeFileSync(
    path.join(root, "src/app/background/index.ts"),
    "console.log(import.meta.env.EXTRO_PUBLIC_GREETING, import.meta.env.PRIVATE_SECRET)\n",
  );
  for (const [name, body] of Object.entries(envFiles)) {
    writeFileSync(path.join(root, name), body);
  }
  return root;
};

/** Build only the script surfaces (the dev sidecar's shape) and return background.js. */
const buildBackground = async (
  root: string,
  mode: "development" | "production",
): Promise<string> => {
  const outDir = path.join(root, ".out");
  await viteBuild({
    root,
    mode,
    plugins: [extro({ root, scriptsOnly: true })],
    build: { outDir, emptyOutDir: true },
    logLevel: "silent",
  });
  return readFileSync(path.join(outDir, "background.js"), "utf8");
};

describe("env inlining in a real build (ADR 0002)", () => {
  it("inlines EXTRO_PUBLIC_* and never ships an unprefixed var", async () => {
    const root = scaffold({
      ".env": "EXTRO_PUBLIC_GREETING=hello-public\nPRIVATE_SECRET=top-secret\n",
    });
    const bg = await buildBackground(root, "production");
    expect(bg).toContain("hello-public");
    expect(bg).not.toContain("top-secret");
  });

  it("script sidecar in development mode loads .env.development (sidecar bug guard)", async () => {
    const root = scaffold({
      ".env.development": "EXTRO_PUBLIC_GREETING=dev-greeting\n",
      ".env.production": "EXTRO_PUBLIC_GREETING=prod-greeting\n",
    });

    const dev = await buildBackground(root, "development");
    expect(dev).toContain("dev-greeting");
    expect(dev).not.toContain("prod-greeting");

    const prod = await buildBackground(root, "production");
    expect(prod).toContain("prod-greeting");
    expect(prod).not.toContain("dev-greeting");
  });
});
