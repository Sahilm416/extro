# Single typed source for the Route manifest

## Status

Accepted. Arrived at via an `/improve-codebase-architecture` grilling session;
a follow-on to ADR 0003 (it does not change the routing shape that ADR chose,
only how that shape is expressed and enforced).

## Context

The build to runtime routing contract was independently re-declared in five
places with nothing enforcing they agree:

1. `vite-plugin/app-tree.ts` build leaf (`BuildLeaf` / `BuildBoundary`)
2. `vite-plugin/runtimes/routes-module.ts` hand-written string codegen
3. `react/router/types.ts` runtime leaf (`RuntimeLeaf` / `Boundary`)
4. `BoundaryKind` declared as a bare string union in both (2 packages)
5. `vite-plugin/index.ts` `surfaceKey`, a hand-rolled proxy for "did the
   emitted module change"

The load-bearing redeclaration (the codegen) is untyped string concatenation
in a different package from the runtime type that consumes it, so a typo or a
shape change drifts silently. We paid this tax three times shipping #9, #11,
and #10, and the dev-watcher bug class (fixed in `6036c55`) traces to the same
seam. The root reason the seam is stringly: one field, the dynamic route
`pattern`, is a `RegExp` and cannot cross the boundary as data, so the codegen
string became an untyped escape hatch for the whole route shape.

## Decision

1. **`RouteManifest` is the single typed source**, defined in `@extrojs/types`
   (zero runtime deps; already the shared home of the `RouteShape<TLeaf>`
   skeleton). It is the serializable, per-Routable-surface description of its
   Routes, each Route's boundary chain, and its not-found / root-layout. See
   the `CONTEXT.md` "Route manifest" term.

2. **Enforcement is a round-trip test, not type-level derivation.**
   `@extrojs/types` owns the shared atoms (`BoundaryKind`, the `RouteShape`
   skeleton). Build and runtime leaves stay two small types referencing those
   atoms. The real cross-package guarantee is a test: build a fixture
   `RouteManifest`, `emit` it, evaluate the generated module in Node, assert
   the result satisfies the runtime `Route[]` type. Type-level field-swap
   derivation (mapped types rewriting `file -> load` recursively) was rejected:
   brittle, inscrutable errors, and it still cannot see codegen text defects a
   round-trip catches.

3. **The whole runtime routing contract type relocates to `@extrojs/types`**
   (`BoundaryKind`, the leaf, `Boundary`, runtime `Route`).
   `@extrojs/react/router` re-exports them so its public surface is unchanged.
   This avoids a backward `vite-plugin -> @extrojs/react` package edge (the
   build package must not depend on the runtime package); both already depend
   on the zero-dep types package.

4. **The deepened Module is the routes-module codegen only** (the shim,
   `runtime-module.ts`, stays separate boilerplate; it is not contract-bearing
   data). Three thin pure pieces, all keyed off the one source:
   - `routeManifest(AppTree, surface) -> RouteManifest` (pure projection;
     does not restructure the scanner)
   - `emit(RouteManifest) -> string` (the only code that knows the text form:
     lazy `import()`, the RegExp literal, the `notFound`/`rootLayout` exports)
   - runtime `Route[]`, a derived type from `RouteManifest` via the
     `RouteShape<TLeaf>` skeleton
   `surfaceKey` becomes a stable stringify of the `RouteManifest`, so HMR
   invalidation drift is structurally impossible.

5. **`pattern` is leaf-parameterized.** The manifest carries
   `patternSource: string`; the runtime leaf carries `pattern: RegExp`;
   `emit` is the sole materializer of the transform. `paramKeys: string[]`
   stays in the shared skeleton (byte-identical everywhere). This makes the
   manifest fully serializable (strings only), which is what makes both the
   stable-stringify invalidation key and the round-trip fixture plain data.

## Consequences

- `@extrojs/types` `DynamicRouteShape` is refactored so `pattern` moves out of
  the shared part into the leaf parameterization; `paramKeys` stays shared.
- `app-tree.ts` stops constructing a live `RegExp`; it carries `patternSource`.
- `serializeRoute` / `serializeBoundaries` / `loaderOrNull` collapse into one
  `emit`. `serializeRoute`-style drift is no longer possible without failing
  the round-trip test.
- `surfaceKey` / the invalidation diff is derived from the manifest; the two
  historical HMR drift bugs (the watcher regex, the `fileKey`-ignored-layouts)
  become structurally unreachable for this contract.
- A round-trip test lands as a vitest file under
  `vite-plugin/src/__tests__/` (vitest is already the workspace runner via
  `turbo run test`).
- Two stale items fixed in the same pass: `surfaces.test.ts`'s
  `emptyTree(): AppTree` literal (missing the `notFound`/`rootLayout` fields
  #10 added) and the "no test runner configured" line in `CLAUDE.md`.
- ADR 0003's flat-array / leaf-carries-chain / build-time-resolution shape is
  unchanged. This ADR only relocates and enforces that shape.

## Considered alternatives

- **Type-level derivation of the runtime leaf from the manifest leaf.**
  Rejected (Decision 2): brittle mapped types across a package boundary,
  inscrutable errors, and weaker real coverage than a round-trip test.
- **Keep `pattern: RegExp` in the shared `RouteShape` skeleton.** Rejected
  (Decision 5): a live `RegExp` in the "serializable" manifest weakens the
  stable-stringify key and the fixture; it preserves the exact ambiguity this
  ADR removes.
- **`vite-plugin` takes a dev/type-only dependency on `@extrojs/react`** so
  the test can assert against the runtime `Route`. Rejected (Decision 3): a
  backward edge from the build package to the runtime package.
- **Widen the deepened Module to also own the shim.** Rejected (Decision 4):
  the shim is not contract-bearing data; folding it widens the interface for
  no leverage.
- **Have the scanner emit `RouteManifest` directly.** Rejected (Decision 4):
  that pulls in the separate parallel-maps restructure (a different candidate)
  and couples two refactors.
