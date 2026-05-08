import { describe, it, expect } from "vitest";

import type { ExtroConfig } from "@extro/types";
import type { AppTree } from "../app-tree.js";
import type { SurfaceContext, SurfaceDescriptor, SurfaceName } from "../surfaces.js";

import { SURFACES } from "../surfaces.js";

const findDesc = (name: SurfaceName): SurfaceDescriptor => {
  const desc = SURFACES.find((s) => s.name === name);
  if (!desc) throw new Error(`Descriptor ${name} not found`);
  return desc;
};

const emptyTree = (): AppTree => ({ scripts: {}, surfaces: {} });

const makeCtx = (overrides: Partial<SurfaceContext> = {}): SurfaceContext => ({
  tree: emptyTree(),
  config: {} as ExtroConfig,
  ...overrides,
});

const devCtx = (overrides: Partial<SurfaceContext> = {}): SurfaceContext =>
  makeCtx({ dev: { port: 5173, signalPort: 9012 }, ...overrides });

describe("routable surface descriptors", () => {
  it("popup contributes default_popup pointing at popup.html", () => {
    expect(findDesc("popup").manifestContribution(makeCtx())).toEqual({
      action: { default_popup: "popup.html" },
    });
  });

  it("options contributes options_ui with open_in_tab", () => {
    expect(findDesc("options").manifestContribution(makeCtx())).toEqual({
      options_ui: { page: "options.html", open_in_tab: true },
    });
  });

  it("sidepanel contributes side_panel pointing at sidepanel.html", () => {
    expect(findDesc("sidepanel").manifestContribution(makeCtx())).toEqual({
      side_panel: { default_path: "sidepanel.html" },
    });
  });
});

describe("background descriptor", () => {
  const background = findDesc("background");

  it("is present in dev even when the user has no background file", () => {
    expect(background.isPresent(devCtx())).toBe(true);
  });

  it("is absent in prod when the user has no background file", () => {
    expect(background.isPresent(makeCtx())).toBe(false);
  });

  it("adds tabs to permissions only in dev", () => {
    expect(background.permissions?.(devCtx())).toContain("tabs");
    expect(background.permissions?.(makeCtx())).not.toContain("tabs");
  });
});

describe("content descriptor", () => {
  const content = findDesc("content");

  it("uses config.content.matches when supplied", () => {
    const ctx = makeCtx({
      config: { content: { matches: ["https://example.com/*"] } },
    });
    expect(content.manifestContribution(ctx).content_scripts?.[0]?.matches).toEqual([
      "https://example.com/*",
    ]);
  });

  it("defaults content_scripts matches to <all_urls>", () => {
    expect(
      content.manifestContribution(makeCtx()).content_scripts?.[0]?.matches,
    ).toEqual(["<all_urls>"]);
  });

  it("emits web_accessible_resources only when CSUI is active", () => {
    expect(content.manifestContribution(makeCtx()).web_accessible_resources).toBeUndefined();

    const csuiCtx = makeCtx({
      tree: {
        scripts: { content: { csui: "/abs/page.tsx" } },
        surfaces: {},
      },
    });
    expect(content.manifestContribution(csuiCtx).web_accessible_resources).toEqual([
      { resources: ["content.js"], matches: ["<all_urls>"] },
    ]);
  });

  it("hostPermissions mirrors config.content.matches", () => {
    const ctx = makeCtx({
      config: { content: { matches: ["https://example.com/*"] } },
    });
    expect(content.hostPermissions?.(ctx)).toEqual(["https://example.com/*"]);
  });
});
