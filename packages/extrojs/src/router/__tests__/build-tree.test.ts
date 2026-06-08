import type { ReactElement } from "react";

import { describe, it, expect } from "vitest";

import type { Router } from "../context.js";

import { buildTree } from "../build-tree.js";
import { RouterContext } from "../context.js";
import { ErrorBoundary } from "../error-boundary.js";
import { DefaultError } from "../defaults.js";

// Sentinel components — asserted by reference, never rendered. No DOM.
const Page = () => null;
const L0 = () => null;
const L1 = () => null;
const UserError = () => null;
const NotFound = () => null;
const RootLayout = () => null;

const router = {} as Router;
const ctx = { pathname: "/x", search: "", router };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kid = (el: any): any => el.props.children;

describe("buildTree: ADR 0003 §3/§4/§5 structure", () => {
  it("match: each error nests INSIDE its sibling layout (§3)", () => {
    const tree = buildTree(
      {
        type: "match",
        page: Page,
        params: { id: "1" },
        boundaries: [
          { kind: "layout", component: L0 },
          { kind: "error", component: UserError },
        ],
      },
      ctx,
    ) as ReactElement;

    // Provider -> built-in EB -> L0 -> EB(fallback=UserError) -> Page
    expect((tree as any).type).toBe(RouterContext.Provider);
    expect((tree as any).props.value).toMatchObject({
      pathname: "/x",
      params: { id: "1" },
      router,
    });

    const builtIn = kid(tree);
    expect(builtIn.type).toBe(ErrorBoundary);
    expect(builtIn.props.fallback).toBe(DefaultError);

    const layout = kid(builtIn);
    expect(layout.type).toBe(L0);

    const errBoundary = kid(layout);
    expect(errBoundary.type).toBe(ErrorBoundary);
    // The user error sits inside L0, so it can never catch L0's own throw.
    expect(errBoundary.props.fallback).toBe(UserError);

    const page = kid(errBoundary);
    expect(page.type).toBe(Page);
    expect(page.props.params).toEqual({ id: "1" });
  });

  it("match: nested layouts compose outermost-first; empty chain = just page", () => {
    const tree = buildTree(
      {
        type: "match",
        page: Page,
        params: {},
        boundaries: [
          { kind: "layout", component: L0 },
          { kind: "layout", component: L1 },
        ],
      },
      ctx,
    ) as ReactElement;

    const l0 = kid(kid(tree)); // Provider -> builtInEB -> L0
    expect(l0.type).toBe(L0);
    const l1 = kid(l0);
    expect(l1.type).toBe(L1);
    expect(kid(l1).type).toBe(Page);

    const empty = buildTree(
      { type: "match", page: Page, params: {}, boundaries: [] },
      ctx,
    ) as ReactElement;
    // Provider -> builtInEB -> Page (identity, no wrappers)
    expect(kid(kid(empty)).type).toBe(Page);
  });

  it("not-found: rendered inside the root layout, under the built-in EB (§4/§5)", () => {
    const withRoot = buildTree(
      { type: "not-found", notFound: NotFound, rootLayout: RootLayout },
      ctx,
    ) as ReactElement;

    expect((withRoot as any).type).toBe(RouterContext.Provider);
    expect((withRoot as any).props.value.params).toEqual({});
    const builtIn = kid(withRoot);
    expect(builtIn.type).toBe(ErrorBoundary);
    expect(builtIn.props.fallback).toBe(DefaultError);
    const rl = kid(builtIn);
    expect(rl.type).toBe(RootLayout);
    expect(kid(rl).type).toBe(NotFound);

    const noRoot = buildTree(
      { type: "not-found", notFound: NotFound, rootLayout: null },
      ctx,
    ) as ReactElement;
    // Provider -> builtInEB -> NotFound (no layout wrapper)
    expect(kid(kid(noRoot)).type).toBe(NotFound);
  });

  it("load-error: bare DefaultError, no provider/boundary wrapper (§5)", () => {
    const err = new Error("boom");
    const reset = () => {};
    const tree = buildTree(
      { type: "load-error", error: err, reset },
      ctx,
    ) as ReactElement;

    expect((tree as any).type).toBe(DefaultError);
    expect((tree as any).props.error).toBe(err);
    expect((tree as any).props.reset).toBe(reset);
  });
});
