# AppTree.surfaces is keyed to RouteManifest

## Status

Accepted. From the `/improve-codebase-architecture` review (Candidate 3,
the parallel-maps friction). Refines ADR 0005: the `routeManifest` projection
introduced there becomes a thin accessor. Changes no runtime behavior.

## Context

After ADR 0005, `AppTree` still exposed a Routable surface's contribution as
**three parallel** `Partial<Record<RoutableSurface, _>>` fields — `surfaces`
(`ManifestRoute[]`), `notFound` (`string`), `rootLayout` (`string`) — built by
an assembly loop that populated them in lockstep. `routeManifest(tree,
surface)` then re-zipped the three into `{ routes, notFound, rootLayout }`,
which is structurally exactly `RouteManifest`. The discovered routing for a
surface and the build->runtime manifest for that surface carry **identical
information**; the three-field split plus the re-zip was a shape the scanner
already had, expressed in pieces a discipline-synced loop could desync
silently.

## Decision

1. **`AppTree.surfaces` becomes `Partial<Record<RoutableSurface,
   RouteManifest>>`.** The assembly loop builds one `RouteManifest` per
   surface, so a missing `notFound`/`rootLayout` is a property of one object,
   not a lockstep invariant across three maps. The `notFound` and `rootLayout`
   top-level `AppTree` fields are removed.

2. **`routeManifest(tree, surface)` becomes a thin accessor** —
   `tree.surfaces[surface] ?? { routes: [], notFound: null, rootLayout: null }`.
   It is kept (not inlined) so the empty default lives in one place and the
   named seam consumers/`index.ts` call is unchanged. ADR 0005's fixture-seam
   rationale is intact: the round-trip test still builds a `RouteManifest`
   literal by hand; the seam is the type, not the function.

3. **The four scan-time accumulators stay** (`pagesBySurface`,
   `layoutsBySurface`, `errorsBySurface`, `notFoundBySurface`). They are
   function-local transients of the single glob pass; collapsing them moves
   complexity rather than concentrating it (fails the deletion test), and the
   lockstep desync hazard existed only in the output assembly, which §1
   removes. Scope stays honest.

The deliberate trade-off: `AppTree.surfaces` is now *structurally* the
build->runtime contract type. This is recorded here because a future reader
will reasonably ask "why is the discovered tree the codegen contract?" The
answer: there is no information difference between them, and `AppTree`'s only
genuine breadth over `RouteManifest` (it also spans Script surfaces via
`tree.scripts`) is unaffected — `tree.surfaces` was already Routable-only and
already depended on `@extrojs/types` (`ManifestRoute`), so this adds **no new
package edge**. A preserved `SurfaceRoutes` mirror type was rejected as a
distinction without a difference (a pass-through that fails the deletion
test).

## Consequences

- `routeManifest` drops from a 3-field re-zip to a one-line accessor; the
  lockstep assembly is gone.
- `index.ts`: the `tree` seed literal loses `notFound`/`rootLayout`; the
  "surface gained/lost" check reads `?.routes.length` instead of `?.length`.
- `surfaces.ts` `isPresent: !!tree.surfaces.<name>` is unchanged — a
  `RouteManifest` is truthy, and the scanner only creates the entry when the
  surface has >= 1 page.
- `CONTEXT.md` "Route manifest" / "AppTree" wording sharpened: the per-
  Routable-surface slot of the AppTree *is* that surface's Route manifest.
- Behavior byte-identical (verified by the existing test suite + example
  prod build).

## Considered alternatives

- **Distinct `SurfaceRoutes` AppTree-side type mirroring `RouteManifest`.**
  Rejected (Decision, trade-off): a near-identical second type plus a trivial
  mapping; carries no extra information; deletion test says fold it.
- **Also nest the four scan accumulators per surface.** Rejected
  (Decision 3): churn without locality gain; the real friction was the output
  shape, fixed by §1.
