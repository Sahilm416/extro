# Single install surface via subpath re-exports

## Context

Extro ships as a pnpm + Turborepo monorepo. Through 0.2.0 the user-facing surface was spread across several published npm names: `extrojs` (the CLI and `defineConfig`), `@extrojs/router` (`Link` and the routing hooks), `@extrojs/core` (`asset()`), with `@extrojs/react` and `@extrojs/types` behind them. Using the framework meant adding three or four Extro dependencies to a project's `package.json` and learning which symbol lived in which package.

We want the Next.js install story: one dependency in `package.json` (`extrojs`), every symbol reached through a subpath (`extrojs/link`, `extrojs/navigation`, `extrojs/asset`). `next` exposes a wide API from a single name you install, and you never `npm i @next/router`.

## Decision

`extrojs` becomes the single package a user adds. It depends on the existing `@extrojs/*` packages and re-exports their public surface under Next-style subpaths. The scoped packages stay published and arrive transitively; users never name them.

1. **Subpath map.** The recommended contract is:
   - `extrojs` — `defineConfig`, `ExtroConfig`, and the `extro` bin
   - `extrojs/client` — ambient env types
   - `extrojs/asset` — `asset()`
   - `extrojs/link` — `Link`
   - `extrojs/navigation` — routing hooks and the Route prop types
   - `extrojs/runtime` — `createExtroRouter`, `matchRoutes`; internal, emitted by the generated Runtime module, not for direct user import

   Subpaths are function- or component-named after the Next model. `Link` and the hooks split across `/link` and `/navigation` to mirror `next/link` plus `next/navigation`.

2. **Thin facade, not bundling.** Each subpath is a one-line re-export in `src/exports/`, compiled by plain `tsc` (`export { Link } from "@extrojs/router"`). Its `.d.ts` re-exports the same way and resolves through the transitively-installed scoped package. No bundler and no declaration rollup: the `extrojs` build stays `tsc`.

3. **React is an optional peer.** `react` and `react-dom` are optional peer dependencies of `extrojs`. Only `extrojs/link` and `extrojs/navigation` pull React; the root config, `extrojs/asset`, and `extrojs/client` are React-free. A background- or content-script-only extension installs `extrojs` alone with no peer warnings.

4. **The generated Runtime module imports `extrojs/runtime`** (`runtime-module.ts`) instead of `@extrojs/router`, so the one import path the plugin emits into a user's bundle is an `extrojs` subpath.

## Consequences

The example and docs import from the subpaths (`extrojs/link`, `extrojs/navigation`, `extrojs/asset`); `examples/basic` now depends only on `extrojs` plus the React peers.

Two public import contracts coexist: the recommended `extrojs/*` subpaths and the underlying `@extrojs/*` packages, which stay published and remain importable directly. Docs steer users to the subpaths. That is the accepted cost of the facade; releases keep versioning the scoped packages as before, and `updateInternalDependencies: "patch"` re-points `extrojs` at the current scoped versions on every release, so `extrojs` never pins a stale internal.

The internal deps use `workspace:^` (not `workspace:*`), so they publish as caret ranges rather than exact pins. This matters because `@extrojs/router` holds a React context singleton: if a project also installs `@extrojs/router` directly, a caret lets npm dedupe a compatible version to one copy, where an exact pin would force two copies, two contexts, and routing hooks that throw. Caret plus the "install only `extrojs`" guidance keeps the router a singleton.

## Considered alternatives

- **Self-contained single package.** Inline the `@extrojs/*` source into `extrojs/dist` (tsup) and mark the scoped packages `private`, so only `extrojs` ships. Attempted, then backed out. Bundling the JS was clean, but rolling up the `.d.ts` so each subpath stays self-contained fought the tooling: tsup's dts pass left dangling references to the scoped packages' internal modules rather than inlining the declarations, and getting `rollup-plugin-dts` to inline reliably meant extra machinery in what should be a plain `tsc` package. The scoped packages are already published, so the facade reaches the same one-install DX with no declaration-bundling machinery. We chose the simpler mechanism and accept the two coexisting contracts above.
- **A single `extrojs/router` subpath for all routing.** Rejected in favor of the Next-style `/link` plus `/navigation` split.
- **React as a hard peer dependency.** Rejected. Optional peers keep script-only extensions React-free.
