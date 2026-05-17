import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, it, expect, afterAll } from "vitest";

import type { RouteManifest, RuntimeRoute } from "@extrojs/types";
import type { AppTree } from "../app-tree.js";

import { emit } from "../runtimes/routes-module.js";
import { routeManifest, scanAppTree } from "../app-tree.js";

// The runtime Route type, module-agnostic (no React) — the same derivation
// @extrojs/react instantiates with component types. ADR 0005.
type StructuralRoute = RuntimeRoute<{ default: unknown }, { default: unknown }>;

const tmp = mkdtempSync(path.join(tmpdir(), "extro-rt-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/**
 * Evaluate an emitted routes module the way the runtime would: write it,
 * import it. The lazy `import()` thunks are never invoked, so the referenced
 * source files don't need to exist — we only assert the materialized shape.
 */
async function evalModule(source: string) {
  const file = path.join(tmp, `m-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, source);
  return import(pathToFileURL(file).href) as Promise<{
    routes: StructuralRoute[];
    notFound: (() => Promise<unknown>) | null;
    rootLayout: (() => Promise<unknown>) | null;
  }>;
}

describe("emit: Route manifest -> runtime module round-trip", () => {
  // tsc enforces the fixture IS a valid RouteManifest; the round-trip
  // enforces emit's OUTPUT is a valid runtime Route[]. Together they close
  // the build->runtime drift the contract used to allow (ADR 0005).
  const manifest: RouteManifest = {
    routes: [
      {
        type: "static",
        path: "/",
        file: "/app/popup/page.tsx",
        boundaries: [
          { kind: "layout", file: "/app/popup/layout.tsx" },
          { kind: "error", file: "/app/popup/error.tsx" },
        ],
      },
      {
        type: "dynamic",
        path: "/c/:id",
        paramKeys: ["id"],
        patternSource: "^/c/([^/]+)$",
        file: "/app/popup/c/[id]/page.tsx",
        boundaries: [{ kind: "layout", file: "/app/popup/layout.tsx" }],
      },
    ],
    notFound: "/app/popup/not-found.tsx",
    rootLayout: "/app/popup/layout.tsx",
  };

  it("emits routes whose materialized shape satisfies the runtime Route type", async () => {
    const mod = await evalModule(emit(manifest));

    expect(Array.isArray(mod.routes)).toBe(true);
    expect(mod.routes).toHaveLength(2);

    for (const r of mod.routes) {
      expect(["static", "dynamic"]).toContain(r.type);
      expect(typeof r.load).toBe("function");
      for (const b of r.boundaries) {
        expect(["layout", "error"]).toContain(b.kind);
        expect(typeof b.load).toBe("function");
      }
    }

    const dyn = mod.routes.find((r) => r.type === "dynamic");
    if (!dyn || dyn.type !== "dynamic") throw new Error("no dynamic route");
    // The whole reason the codegen string exists: patternSource -> RegExp.
    // The contract is "equivalent to new RegExp(patternSource)" — RegExp
    // normalizes `/` in .source, so compare against that same construction.
    const expected = new RegExp("^/c/([^/]+)$");
    expect(dyn.pattern).toBeInstanceOf(RegExp);
    expect(dyn.pattern.source).toBe(expected.source);
    expect(dyn.pattern.flags).toBe(expected.flags);
    expect("/c/123".match(dyn.pattern)?.[1]).toBe("123");
    expect(dyn.paramKeys).toEqual(["id"]);

    expect(typeof mod.notFound).toBe("function");
    expect(typeof mod.rootLayout).toBe("function");
  });

  it("emits null (not undefined/missing) when notFound/rootLayout absent", async () => {
    const mod = await evalModule(
      emit({ routes: [], notFound: null, rootLayout: null }),
    );
    expect(mod.routes).toEqual([]);
    expect(mod.notFound).toBeNull();
    expect(mod.rootLayout).toBeNull();
  });
});

describe("routeManifest: accessor for one surface's manifest (ADR 0007)", () => {
  it("returns the surface's manifest, or an empty manifest when absent", () => {
    const popupManifest: RouteManifest = {
      routes: [{ type: "static", path: "/", file: "/p.tsx", boundaries: [] }],
      notFound: "/nf.tsx",
      rootLayout: null,
    };
    const tree: AppTree = {
      scripts: {},
      surfaces: { popup: popupManifest },
    };

    expect(routeManifest(tree, "popup")).toBe(popupManifest);
    expect(routeManifest(tree, "options")).toEqual({
      routes: [],
      notFound: null,
      rootLayout: null,
    });
  });
});

describe("scanAppTree: §3 boundary order (the scanner half of the lock)", () => {
  it("emits layout BEFORE error within a segment, so the runtime fold nests the error inside its sibling layout", async () => {
    const root = mkdtempSync(path.join(tmp, "scan-"));
    const seg = path.join(root, "src/app/popup");
    mkdirSync(seg, { recursive: true });
    const stub = "export default function X(){return null}";
    writeFileSync(path.join(seg, "page.tsx"), stub);
    writeFileSync(path.join(seg, "layout.tsx"), stub);
    writeFileSync(path.join(seg, "error.tsx"), stub);

    const tree = await scanAppTree(root);
    const route = tree.surfaces.popup?.routes[0];
    if (!route) throw new Error("popup route not scanned");

    // buildTree folds this array; layout-before-error here is exactly what
    // makes <Layout><ErrorBoundary> ... (ADR 0003 §3). Drift here would pass
    // every buildTree test yet silently break §3 — hence this assertion.
    expect(route.boundaries.map((b) => b.kind)).toEqual(["layout", "error"]);
  });
});
