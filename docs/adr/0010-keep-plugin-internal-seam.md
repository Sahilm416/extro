# Keep the plugin's internal seam

## Context

After the single-package collapse (ADR 0009), the Vite plugin and the CLI live in one package. `src/plugin/internal.ts` re-exports ~20 plugin internals (`scanAppTree`, `classifyScriptChange`, `mergeDirty`, `resolveFlush`, `emitAssets`, `discoverAssets`, `composeArtifacts`, `SURFACES`, ...) that the CLI uses to assemble the dev loop and write artifacts. It has exactly one consumer: the CLI (`src/commands/dev.ts`, `src/dev-assets.ts`).

By the "one consumer means a hypothetical seam" heuristic, an architecture review flags `internal.ts` as a candidate to collapse: inline the imports into the concrete plugin files and delete the aggregator. This came up in an `/improve-codebase-architecture` pass.

## Decision

Keep `internal.ts` as a deliberate internal seam. It curates "the plugin surface the CLI is allowed to reach" in one place. Collapsing it would disperse the CLI's plugin imports across six files (`app-tree`, `dev-reactions`, `emit-assets`, `surfaces`, `generators/html`, ...) and erase that contract for no real gain. `plugin/index.ts` (the `extro()` Vite plugin, public as `extrojs/vite`) stays the bundling entry; `internal.ts` stays the build/dev-orchestration entry. The split is by role, not by the old package boundary.

This differs from the truly vestigial barrels removed in the same review (`core/index.ts`, `react/index.ts`): those re-exported a single symbol with no curation value and failed the deletion test. `internal.ts` aggregates and documents a real internal contract.

## Consequences

The CLI imports from two plugin entries (`../plugin/index.js` for the plugin, `../plugin/internal.js` for orchestration primitives). This is intentional; a reader learns the plugin folder has two roles. Recorded so future testability/architecture reviews do not re-suggest collapsing the seam.

## Deferred

- **Deepen the dev loop.** Today the CLI hand-assembles the watch -> Dev reaction -> effect loop from `internal.ts` primitives. A narrower, deeper interface (so the CLI orchestrates through one entry instead of reaching for parts) is a genuine deepening, but a real design decision left to a future grilling session. It must preserve the CONTEXT.md invariant that the Dev reaction stays pure and the watcher owns I/O.
