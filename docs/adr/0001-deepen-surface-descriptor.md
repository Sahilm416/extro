# Deepen the SurfaceDescriptor

## Context

Extro's `SurfaceDescriptor` (in `surfaces.ts`) carries each Surface's identity and a static manifest fragment, but the load-bearing per-Surface logic lives outside it: `app-tree.ts` hardcodes scan rules per `kind`, `manifest.ts` has four `desc.name === "content"` branches for dynamic Manifest contributions, and the CSUI `web_accessible_resources` rule floats free of any descriptor. Adding or modifying a Surface means edits across five files. The descriptor is shallow: it owns ~70% of a Surface but the missing 30% is exactly what changes when conventions evolve.

## Decision

Deepen the `SurfaceDescriptor` so each record owns its contributions as functions of build context.

1. **Audience: internal, possibly public later.** The descriptor table is not a plugin extensibility seam today. Shape the contract as if it could become public, but do not export or commit to stability.
2. **CSUI is a Mode of the Content surface, not a separate Surface.** The Content descriptor handles both shapes (raw script, CSUI-mounted) and emits the WAR contribution itself when CSUI is active. `tree.csui` is removed; `tree.scripts.content` becomes `{ script?: string; csui?: string }` with at-least-one-set enforced by the scanner.
3. **Contributions become functions of context.** `manifestContribution(ctx)`, `permissions(ctx)`, `hostPermissions(ctx)`, and `isPresent(tree, ctx)` all receive `ctx` carrying `{ tree, config, dev }`. Background self-reports present in dev; Content reads `config.content?.matches` itself; the WAR rule is part of Content's Manifest contribution.
4. **Scan strategy stays kind-dispatched.** `app-tree.ts` keeps two strategies (routable, script). The CSUI exception (Content also accepts `page.tsx`) becomes a flag on the Content descriptor, replacing the stringly `if (surface === "content" && isPage)`.
5. **HTML and runtime modules stay derived from `kind`.** `emit-assets.ts` and the runtime generators iterate `SURFACES.filter(s => s.kind === "routable")`. The standalone `ROUTABLE_SURFACES` constant goes away.

## Consequences

`manifest.ts` collapses to a flat reducer over `SURFACES`: assign fragment, union permissions, union host permissions. The dev-mode tree mutation, the four Content special-cases, the inline `tabs` permission gate, and the floating CSUI WAR block all disappear. Each descriptor becomes pure-testable in isolation against a hand-built `(tree, config, dev)`. The dev watcher gap in `cli/index.ts:150,157` (which checks `tree.scripts.content` but not `tree.csui`) closes for free once both Modes share one slot.

## Considered alternatives

- **CSUI as a sixth Surface.** Rejected: CSUI ships through the same `content.js` bundle and the same content-script manifest entry. Treating it as a sibling created two descriptors that were always coupled at build time, and forced the WAR rule to coordinate across descriptors.
- **Static fields with optional `override(manifest, ctx)` hooks.** Rejected: bakes in the asymmetry between Content and the other Surfaces (Content always overrides, others never do). Two ways to declare the same thing; the override path effectively becomes the only path.
- **Per-descriptor `scan(root)` functions.** Rejected: three Routable Surfaces would carry near-identical implementations, with the shared helper becoming a de-facto strategy. More ceremony, no locality gain.
- **Discriminated union for the Content slot (`{ mode: "script" | "csui" | "both"; ... }`).** Rejected: the type-level invariant came at the cost of narrowing at every read site, for an invariant the scanner already guarantees once.
