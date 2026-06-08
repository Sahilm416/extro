import type { AppTree } from "./app-tree.js";
import { routeManifest } from "./app-tree.js";
import type { RoutableSurface } from "./surfaces.js";

/**
 * @file dev-reactions.ts
 * @description Dev reactions: the framework's decision about what to do when a
 * watched `src/app` file changes during `extro dev`. Pure functions only. The
 * watchers that trigger them own every effect (rescan, broadcast, module
 * invalidation); nothing here touches the filesystem, the module graph, or the
 * WebSocket. The decisions are the test surface.
 *
 * Two complementary halves:
 *   - the script reaction (`classifyScriptChange` + the dirty reducer), driven
 *     by the CLI's Rollup build watcher over background/content;
 *   - the tree reaction (`decideTreeReaction`), driven by the plugin's
 *     dev-server watcher over the Routable surfaces.
 */

// ---------------------------------------------------------------------------
// Script reaction — which Script surfaces a rebuild touches
// ---------------------------------------------------------------------------

/** Which Script surfaces a dev rebuild dirties. */
export interface ScriptDirty {
  background: boolean;
  content: boolean;
}

/**
 * A changed file under `src/app/background/` dirties background; under
 * `src/app/content/` dirties content; anything else (shared code) dirties both.
 * This is the only place that knows the `src/app` layout, so the CLI no longer
 * hardcodes those paths.
 */
export function classifyScriptChange(changedPath: string): ScriptDirty {
  const p = changedPath.replace(/\\/g, "/");
  const background = p.includes("/src/app/background/");
  const content = p.includes("/src/app/content/");
  if (!background && !content) return { background: true, content: true };
  return { background, content };
}

/** Union two dirty states (accumulating `change` events across one build). */
export function mergeDirty(a: ScriptDirty, b: ScriptDirty): ScriptDirty {
  return {
    background: a.background || b.background,
    content: a.content || b.content,
  };
}

/**
 * Resolve the accumulated dirty state at `BUNDLE_END`. No classified change
 * (the initial build, or an `extro dev` restart) conservatively means both,
 * matching the broadcast-on-first-build behavior.
 */
export function resolveFlush(dirty: ScriptDirty): ScriptDirty {
  if (!dirty.background && !dirty.content) {
    return { background: true, content: true };
  }
  return { background: dirty.background, content: dirty.content };
}

// ---------------------------------------------------------------------------
// Tree reaction — what an AppTree diff means for the dev server
// ---------------------------------------------------------------------------

/**
 * The reaction to a Routable-side change.
 *   - `restart`: a Surface was born mid-session. `rollupOptions.input` was
 *     fixed at `config()` time, so a fresh `extro dev` is required to register
 *     the new entry.
 *   - `invalidate`: existing Routable surfaces gained or lost a Route; their
 *     routes virtual modules must reload so the runtime picks up the new array.
 *   - `noop`: nothing actionable changed.
 */
export type DevReaction =
  | { kind: "restart"; surface: "background" | "content" | RoutableSurface }
  | { kind: "invalidate"; surfaces: RoutableSurface[] }
  | { kind: "noop" };

/**
 * Diff two AppTrees into a {@link DevReaction}. A birth short-circuits the
 * invalidate scan: the session has to restart regardless of any route delta.
 */
export function decideTreeReaction(
  prev: AppTree,
  next: AppTree,
  routables: readonly RoutableSurface[],
): DevReaction {
  if (!prev.scripts.background && next.scripts.background) {
    return { kind: "restart", surface: "background" };
  }
  if (!prev.scripts.content && next.scripts.content) {
    return { kind: "restart", surface: "content" };
  }
  for (const surface of routables) {
    const had = (prev.surfaces[surface]?.routes.length ?? 0) > 0;
    const has = (next.surfaces[surface]?.routes.length ?? 0) > 0;
    if (has && !had) return { kind: "restart", surface };
  }

  // The Route manifest IS what the routes module emits and is fully
  // serializable, so its stable stringify is a faithful identity: invalidation
  // can no longer drift from the contract (ADR 0005). This is what kills the
  // historical HMR-drift bug class.
  const changed: RoutableSurface[] = [];
  for (const surface of routables) {
    const key = (t: AppTree) => JSON.stringify(routeManifest(t, surface));
    if (key(prev) !== key(next)) changed.push(surface);
  }
  return changed.length ? { kind: "invalidate", surfaces: changed } : { kind: "noop" };
}
