# Dev reactions: pure decisions behind the dev watchers

## Status

Accepted. From an `/improve-codebase-architecture` grilling session
(Candidate 2). It relocates the dev-mode change decisions behind one seam and
changes no runtime behavior.

## Context

A single question, "a watched `src/app` file changed in dev, what should
happen?", was answered in two complementary places, each tangling the decision
with its effect and its stateful plumbing so that neither could be tested
without booting real I/O:

1. **Script side** (`cli/commands/dev.ts`, driven by the Rollup build watcher).
   Two mutable flags (`bgDirty`, `csDirty`) classified each changed path,
   accumulated across `change` events, and at `BUNDLE_END` broadcast
   `bg-rebuilt` / `cs-rebuilt`. The classification hardcoded `/src/app/background/`
   and `/src/app/content/` in the CLI, so the framework's `src/app` layout leaked
   into the CLI package.

2. **Routable side** (`vite-plugin/index.ts` `handleChange`, driven by the
   dev-server watcher). It rescanned the AppTree and inlined a ~40-line decision:
   diff prev vs next to detect a Surface birth (log a restart hint and bail),
   else compare each surface's Route-manifest key to decide a routes-module
   invalidation.

They are not duplicates; they are the two halves of one decision. Both buried
load-bearing rules ("a background-only edit must not reload tabs"; "a new
Surface needs a restart because the Rollup input was frozen at `config()` time")
in event handlers, with no test and no shared home. The recurring HMR-drift bug
class (ADR 0005's context) traces to this seam.

## Decision

1. **Introduce the Dev reaction: pure decisions in one framework module.**
   `vite-plugin/src/dev-reactions.ts` holds both halves and performs no I/O. See
   the `CONTEXT.md` "Dev reaction" term.

2. **Script reaction.** `classifyScriptChange(path) -> { background, content }`
   (shared code, matching neither dir, dirties both), with `mergeDirty` and
   `resolveFlush` (an empty accumulation resolves to both) modelling the
   accumulate-then-flush as pure transitions. The CLI handler holds the running
   state and performs the broadcast; the `src/app` path knowledge now lives in
   the framework, beside `APP_FILE_BASENAMES`, not in the CLI.

3. **Tree reaction.** `decideTreeReaction(prev, next, routables) -> DevReaction`,
   a discriminated union: `restart` (a Script or Routable surface born
   mid-session), `invalidate` (the Routable surfaces whose Route manifest
   changed), or `noop`. A birth short-circuits the invalidate scan. The plugin
   handler maps `restart` to the log hint and `invalidate` to `reloadModule`.

4. **Effects stay at the thin edge.** The pure module never rescans, broadcasts,
   touches the module graph, or logs. The watchers own all of that. The
   reactions are the test surface.

5. **The dev signal strings stay where they are.** `classifyScriptChange`
   returns a decision, not a wire message; the handler still calls
   `broadcast({ kind: "bg-rebuilt" })`. Giving that protocol a typed home is a
   separate seam (the review's Candidate 3) and is not touched here.

## Consequences

New: `vite-plugin/src/dev-reactions.ts` and
`vite-plugin/src/__tests__/dev-reactions.test.ts` (table tests over `(path)` and
`(prevTree, nextTree)` for every reaction: the births, the route-delta
invalidation across multiple surfaces, the empty-to-both flush, and
birth-beats-invalidate). Touched: `index.ts` (`handleChange` shrinks to
decide-then-act), `cli/commands/dev.ts` (the two flags become the reducer),
`internal.ts` (exports the script-side functions + `ScriptDirty` for the CLI).

Rules that previously required a live Vite dev server, a Rollup watcher, and the
module graph to exercise are now unit tests. The behavior is identical: same
birth precedence and early return, same invalidate set, same empty-to-both
fallback.

## Considered alternatives

- **Plugin-side only** (extract `decideTreeReaction`, leave the CLI flags
  inline). Rejected: it leaves the `src/app` path convention leaking into the
  CLI and the accumulate/flush untested, and splits a concept that reads better
  whole.
- **Two modules, one per package.** Rejected: the script classifier depends on
  framework layout knowledge (`src/app/<surface>/`), so its home is the
  framework. Keeping it in the CLI would re-state a framework convention in a
  consumer.
- **Fold the dirty reducer down to a single classify call, mutating two flags in
  the handler.** Rejected: the empty-to-both flush rule is load-bearing and was
  worth making testable; `mergeDirty` / `resolveFlush` cost almost nothing and
  close that gap.
- **Return wire messages (`"bg-rebuilt"`) from the pure functions.** Deferred:
  that couples the decision to the dev signal protocol, which is its own seam
  (Candidate 3). The decision returns surfaces; the handler owns the wire.
