# Routing primitives (layout, error, not-found)

## Status

Accepted. Ratified via grilling session for issue #8; unblocks #9 (layout),
#10 (not-found), #11 (error). #12 (loading) stays deferred per §2.

## Context

Extro's router today resolves a single leaf `page.tsx` per hash and renders it
bare: `create-router.ts` does `matchRoutes(path)` → `await leaf.route.load()` →
`root.render(<Component params />)`. There is no shared chrome, no error
isolation, and an unmatched hash logs to the console and leaves the surface
blank.

The match layer was already built in anticipation of this work: `match.ts`
returns `RouteMatch[]` (a chain), with the explicit comment that the chain is
length 1 today but "when layouts land the chain will walk from root layout →
... → leaf page". `examples/basic` already nests routes (`popup/settings`,
`popup/c/[id]`, `options/about`).

This ADR resolves the design questions for the Next.js-style routing primitives
so the implementation issues (#9 layout, #10 not-found, #11 error) can proceed
unambiguously.

## Decision

### 1. Segment-level parity (Next.js App Router semantics)

Any directory under a Routable surface may hold `layout.tsx`, `error.tsx`, or
`not-found.tsx`. They nest: `popup/layout.tsx` wraps the whole popup,
`popup/settings/layout.tsx` wraps only that subtree, innermost-first.

Rationale: the runtime author already paid the design cost (`matchRoutes`
returns a chain ready for nesting); the product is positioned as "Next.js for
Chrome extensions" and the project convention is to defer to Next.js semantics;
`examples/basic` already has nested trees that benefit from shared chrome.

The cost (surface-level only would have been simpler) is concentrated in the
scanner resolving ancestor chains and the runtime composing them — accepted as
inherent to the parity promise.

### 2. `loading.tsx` is deferred (issue #12 stays open)

`loading.tsx` is **not** part of this batch. Reasons:

- Route modules are local bundled chunks (`chrome-extension://` in prod,
  `localhost` in dev). A dynamic `import()` resolves in sub-frame time; the
  lazy-import window `loading.tsx` fills is effectively invisible.
- The router uses a manual `await load()` + `root.render`, not React Suspense.
  `loading.tsx` could therefore only cover the module-fetch window, never
  component-level data fetching (`chrome.storage`, API calls) — the actually
  perceptible latency in extension UIs. Shipping it would set a misleading
  expectation.

Revisit when/if Extro grows a Suspense-based data layer; at that point
`loading.tsx` becomes a real Suspense boundary with genuine meaning. Issue #12
remains open, blocked on that condition.

### 3. `error.tsx` nesting mirrors Next.js exactly

Each segment's error boundary is rendered *inside* that segment's own
`layout.tsx`, wrapping the segment's `page.tsx` and all deeper segments. For:

```
popup/{layout L0, error E0, page P0}
popup/settings/{layout L1, error E1, page P1}
```

the composition for `#/settings` is:

```
<L0><E0> <L1><E1> <P1/> </E1></L1> </E0></L0>
```

Load-bearing rule: **`error.tsx` does not catch errors thrown in its own
sibling `layout.tsx`** — only in its `page.tsx` and everything nested below
(including descendant layouts). So `P1` throws → `E1`; `L1` throws → `E0`;
the surface-root `L0` throws → no boundary, falls to the built-in default
(§5).

`error.tsx` receives `{ error, reset }`; `reset()` re-renders the boundary's
contents (the page and below), leaving the sibling layout mounted.

Rationale: the layout holds shared chrome (nav/header) that must stay
interactive when a page crashes; this is the exact mental model Next.js users
already have, which is the brand promise.

### 4. `not-found.tsx` is per-Surface, unmatched-hash trigger only

Unlike `layout`/`error` (which wrap a *matched* chain and nest), `not-found`
fires when **nothing matched** — there is no segment chain to nest into.

- One optional `src/app/<surface>/not-found.tsx` per Routable surface.
- Trigger: `matchRoutes(path)` returns `null`. (Replaces today's
  `console.error` + blank surface.)
- Rendered inside the surface-root `layout.tsx` only (shared chrome stays);
  no deeper layout is in scope because nothing matched.
- Absent → built-in default 404 (§5), never blank/console-only.
- **No** imperative `notFound()` and **no** segment-level not-found
  resolution.

Rationale: with zero matched segments "nearest segment" is undefined and a
longest-prefix resolver is real complexity a popup hits ~never; segment-level
not-found's value in Next.js comes from `notFound()` thrown by deep data
fetching, which is the deferred Decision-2 (Suspense) territory. Revisited
with that same future work.

Known limitation: a route that *matched* but has invalid params (e.g.
`/c/[id]` with a bad `id`) cannot declaratively show not-found; it renders
its own content for now.

### 5. Prop contracts and built-in defaults

Default exports:

| File | Signature |
|---|---|
| `layout.tsx` | `({ children }: { children: ReactNode })` — no `params` prop; params via the `useParams()` hook |
| `error.tsx` | `({ error, reset }: { error: Error; reset: () => void })` — plain `Error`, no `digest` |
| `not-found.tsx` | `()` — no props |

Built-in defaults (live in `@extrojs/react`, not generated):

- No `layout.tsx` → identity (render children).
- No `error.tsx` in chain → a minimal built-in error boundary is **always the
  outermost wrapper** at the surface root: guarantees no blank surface on a
  thrown page, and catches the §3 gap where the surface-root `layout.tsx`
  throws. Renders unstyled "Something went wrong" + `error.message`.
- No `not-found.tsx` → minimal built-in 404 (`No route for <path>`).

`error.message` is shown always (not generic-in-prod): an extension error
surface is seen by the developer far more than end users. Prod message-hiding
is a future hardening toggle, out of v0.x scope.

### 6. Scanner & route-shape change: extend the leaf, keep the flat array

The layout/error chain is resolved **at build time onto each route**, not via
a runtime tree walk:

- The scanner globs `{page,index,layout,error}.{ts,tsx}`; only
  `src/app/<surface>/not-found.{ts,tsx}` is recognized (deeper `not-found`
  files are silently ignored in v0 per §4, documented in the user docs).
- For each `page.tsx` at segments `S`, the scanner walks ancestor dirs
  surface-root → leaf, collecting the `layout`/`error` files that exist.
- The `RouteShape<TLeaf>` generic (already present for exactly this kind of
  per-side payload) is extended at the leaf with a **single ordered boundary
  list**, outermost first, layout-before-error within a segment:
  - build leaf: `{ file }` → `{ file, boundaries: { kind, file }[] }`
  - runtime leaf: `{ load }` → `{ load, boundaries: { kind, load }[] }`
    where `kind` is `"layout" | "error"`

  (The §6 draft said two parallel `layouts`/`errors` arrays. That cannot
  express the §3 interleave — `error` nested *inside* its sibling `layout`
  per segment, with holes when either is absent. One ordered list folds
  inside-out in a single pass and handles holes naturally. §3 semantics are
  unchanged; this is the faithful encoding of them.)
- `not-found` is a **per-surface** value emitted beside `routes`, not a route
  field.
- **`match.ts` is unchanged.** The match stays a length-1 chain; composition
  data rides on the matched route's boundary list. (The old "chain will grow"
  comment in `match.ts` was corrected to reflect this.)

`generateRoutesModule` emits the ordered `boundaries` list plus (for #10) a
sibling `notFound` export; `runtime-module.ts` passes `notFound` and the
built-in defaults into `createExtroRouter`. Composition happens in
`create-router.ts` by `reduceRight` over `boundaries`: an always-on built-in
outermost error boundary → `<L0><E0> … <Page params/> … </E0></L0>`, each
segment's error rendered inside its sibling layout. A failed boundary/page
import (outside React render, so uncatchable by a boundary) renders the
built-in error rather than blanking the surface. On no match, the per-surface
`notFound` (user or built-in) renders inside `L0` only.

Rejected: building a real route tree and walking it at match time. It
contradicts the deliberate flat-sorted-array design (a flat array with a
chain-*shaped return* so no tree exists), is a larger refactor, and re-does
chain resolution on every navigation instead of once at build.

### 7. Domain vocabulary

CONTEXT.md gains a **Routing primitives** subsection (updated inline this
session): **Segment** (a directory level under a Routable surface; Segments
nest; a Route belongs to its deepest Segment), **Layout**, **Error boundary**,
**Not-found fallback**, and **Routing primitive** (the collective). A
**Routing primitive** is explicitly *not* an **Entry** (the Route's own
source) and *not* a **Route** — captured in the Flagged ambiguities section
so the `layout` overload against **HTML shell** is resolved.

## Consequences

- The `RouteShape` leaf grows two arrays; the generic was built for this, so
  `@extrojs/types`, `app-tree.ts`, and the runtime types extend rather than
  restructure. `match.ts` and the sort order are untouched.
- `app-tree.ts` does the only non-trivial new work: ancestor-chain resolution
  per page. This is pure and unit-testable against a hand-built file list.
- `create-router.ts` gains a composition step (build the nested
  layout/error/built-in tree around the page) and a no-match branch that
  renders `notFound` instead of `console.error`. The always-on outermost
  built-in error boundary means a surface can no longer render blank.
- `@extrojs/react` ships two tiny built-in components (default error, default
  404). These are public-surface and should stay unstyled/minimal.
- `match.ts`'s "chain will grow" comment becomes stale and must be corrected
  to "match stays length 1; layout/error chains ride on the route."
- #9 (layout) is implemented first; #11 (error) depends on it (boundaries
  nest inside layouts); #10 (not-found) is independent of both. #12 (loading)
  is out of scope and stays open, blocked on a future Suspense data layer.
- `examples/basic` gains a popup `layout.tsx` (and an `error.tsx`/
  `not-found.tsx` demo) per the issues' acceptance criteria.

## Considered alternatives

- **Surface-level only** (one optional primitive per Routable surface, no
  nesting). Rejected: the match layer is already a chain, the brand promise is
  Next.js parity, and the example app already nests. Simpler, but undersells
  the framework's core positioning.
- **Ship `loading.tsx` now.** Rejected: see §2 — invisible import window, no
  Suspense data story, misleading expectation.
- **Segment-level `not-found` with longest-prefix resolution.** Rejected
  (§4): undefined "nearest segment" when nothing matched, real resolver
  complexity for a case a popup hits ~never, and its real value is tied to the
  deferred `notFound()`/Suspense work.
- **Real route tree walked at match time.** Rejected (§6): contradicts the
  deliberate flat-array design, larger refactor, repeats chain resolution
  every navigation.
- **`error.tsx` catches its own sibling `layout.tsx`.** Rejected (§3):
  would blow away shared chrome (nav) on a page crash and diverges from the
  Next.js mental model the brand promises.
- **Generic error message in prod.** Rejected (§5): the extension error
  surface is seen by the developer far more than end users in v0.x; revisit
  as a hardening toggle later.
