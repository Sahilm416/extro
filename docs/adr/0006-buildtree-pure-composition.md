# Pure `buildTree` composition with structural tests

## Status

Accepted. From an `/improve-codebase-architecture` grilling session
(Candidate 2, the follow-up review after ADR 0005). It changes no runtime
behavior; it relocates structure and makes ADR 0003 §3/§4/§5 testable.

## Context

The ADR 0003 routing semantics (an `error.tsx` nested *inside* its sibling
`layout.tsx`; not-found rendered inside the surface-root layout; an always-on
built-in error boundary so the surface never blanks) were realized as inline
fragments inside `create-router.ts`'s ~95-line async `render()`: a
`reduceRight` for the match path, a root-layout wrap for no-match, a `provide`
helper, and a bare `DefaultError` for load failure. The structure was
intertwined with orchestration (navToken, `parseLocation`, `matchRoutes`,
`Promise.all` loads, try/catch) and was observable only by driving a real DOM.
The §3 guarantee also spans two packages: the scanner emits the boundary
chain order, the runtime folds it, and that they agree was asserted only by a
comment.

## Decision

1. **One total pure Module: `buildTree(outcome, ctx) -> ReactElement`.**
   It is total over every render outcome: `match` (page + resolved boundary
   chain + params), `not-found` (resolved not-found + optional root layout),
   and `load-error` (error + reset). It owns *all* renderable structure: §3
   boundary nesting, §4 not-found-inside-root-layout, §5 always-on built-in
   error boundary + `RouterContext.Provider`. After this, `render()` contains
   **zero `createElement`**: it is pure orchestration (parse, match, load with
   the navToken guard + try/catch, dispatch). Component/fallback *selection*
   (user vs built-in not-found) stays in the loader, so `buildTree` receives
   already-resolved components and is pure and total.

2. **Tests assert the returned `ReactElement` structure, not rendered DOM.**
   Sentinel components plus a recursive walk of `el.type` / `el.props.children`
   pin the exact nesting (e.g. for `[layout, error]`: Provider -> built-in
   ErrorBoundary(fallback=DefaultError) -> Layout -> ErrorBoundary(fallback=
   userError) -> Page). Zero new dependencies, no DOM.

   **Deliberately not** jsdom/behavioral error-boundary tests. The structural
   shape *implies* the §3 runtime behavior given React's documented
   error-boundary semantics plus the small, separately-obvious `ErrorBoundary`
   class. Adding jsdom would reintroduce the exact DOM dependency this work
   exists to remove, to re-test a behavior React already guarantees. This
   boundary of "what the test proves" is intentional and recorded here so a
   future testability review does not re-suggest behavioral DOM tests.

3. **§3 is locked end-to-end, both halves.** The runtime half is
   `buildTree`'s structural tests. The scanner half (`resolveBoundaryChain`
   emitting layout-before-error within a segment) gets a focused assertion in
   the existing `vite-plugin` route-manifest test, scanning a temp fixture
   through `scanAppTree` (no new export, no widened surface). Neither half can
   now drift from §3 silently.

4. **`@extrojs/react` gains test wiring** (`"test": "vitest run"`,
   `src/router/__tests__/`), mirroring `@extrojs/vite-plugin` exactly. No new
   dependency or `turbo.json` change.

## Consequences

- `create-router.ts` shrinks: `render()` is a linear orchestrator with no
  structure to hide bugs in; `build-tree.ts` is the single, fully
  unit-testable home of ADR 0003 §3/§4/§5.
- Behavior is byte-identical (verified by example prod build parity and the
  existing routing behavior); this is a locality/testability deepening only.
- `@extrojs/react` ships its first tests; the package now participates in
  `pnpm test`.

## Considered alternatives

- **Narrow `composeBoundaries` only** (extract just the `reduceRight`).
  Rejected: leaves §4/§5 and the load-error fallback scattered and DOM-only,
  so the "surface never blank / not-found nests in root layout" guarantees
  stay unlocked.
- **`react-dom/server` snapshot tests.** Rejected: `ErrorBoundary` and
  `Provider` emit no DOM and only diverge on a thrown error, so static markup
  cannot express the wrapper nesting; it adds a dependency to assert less.
- **Lock only the runtime half.** Rejected: relocates the exact
  comment-only cross-package drift Candidate 2 named to the scanner side.
