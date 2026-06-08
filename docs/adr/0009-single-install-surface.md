# Single install surface (one package)

## Context

Extro grew as a pnpm + Turborepo monorepo that published several packages: `extrojs` (the CLI + `defineConfig`), `@extrojs/router`, `@extrojs/core`, `@extrojs/react`, `@extrojs/types`, and `@extrojs/vite-plugin`. Using the framework meant adding several Extro dependencies to a project and learning which symbol lived in which package; shipping it meant publishing six coupled packages in one release.

We want the Next.js model: one package you install (`extrojs`), every symbol reached through a subpath (`extrojs/link`, `extrojs/navigation`, `extrojs/asset`). `next` is a single published package whose `link`, `navigation`, `image`, and bundler glue are folders inside it, not separate npm packages.

## Decision

Collapse the runtime and the build plugin into the one `extrojs` package. The former `@extrojs/*` packages become source folders under `packages/extrojs/src/` (`router/`, `core/`, `react/`, `types/`, `plugin/`). They are no longer separate npm packages.

1. **Subpath map** (the public contract):
   - `extrojs` — `defineConfig`, `ExtroConfig`, and the `extro` bin
   - `extrojs/client` — ambient env types
   - `extrojs/asset` — `asset()`
   - `extrojs/link` — `Link`
   - `extrojs/navigation` — routing hooks and the Route prop types
   - `extrojs/runtime` — `createExtroRouter`, `matchRoutes`; internal, emitted by the generated Runtime module, not for direct user import
   - `extrojs/vite` — the Vite plugin, for the advanced manual-Vite path

   Subpaths are function- or component-named after the Next model. `Link` and the hooks split across `/link` and `/navigation` to mirror `next/link` plus `next/navigation`.

2. **One package, plain `tsc`.** Each subpath entry in `src/exports/` re-exports from a sibling folder with a relative import (`export { Link } from "../router/index.js"`). Because it is all one package compiled by one `tsconfig`, the emitted `.d.ts` reference relative siblings that ship in the same tarball. No bundler, no declaration rollup, no `workspace:` protocol.

3. **Two build passes.** The plugin runs in Node and the runtime in the browser, but they coexist as separate entry points (like `next`). `tsc` builds everything except the content-script runtime clients, which a second `tsc -p tsconfig.runtime.json` builds with DOM + chrome types. The generated Runtime module imports `extrojs/runtime`, resolvable inside the user's bundle.

4. **React is an optional peer.** `react`/`react-dom` are optional peer dependencies; only `extrojs/link` and `extrojs/navigation` pull React. A script-only extension installs `extrojs` alone.

## Consequences

One package publishes. There is no multi-package release: `changeset publish` ships exactly `extrojs`, so there is no partial-publish window where a dependent lands on npm referencing a dependency that didn't. One version, one changelog, one import contract (`extrojs/*`). The `@extrojs/*` names are retired; the 0.2.0 ones already on npm are left as-is.

## Considered alternatives

- **Many published packages (the original layout).** Rejected: every release is an N-package publish with a partial-failure window (a dependent can land on npm pointing at a dependency that failed to publish), and it spreads the user's install across several dependencies.
- **Facade over still-published scoped packages.** `extrojs` re-exports `@extrojs/*` via subpaths while the scoped packages stay published. This reached "one dependency in `package.json`," but still published six coupled packages (the same partial-publish risk) and left two public import contracts (`extrojs/*` and `@extrojs/*`). Rejected once the release risk was weighed against the convenience.
- **Self-contained bundle.** Keep separate workspace packages and inline them into `extrojs/dist` at publish (tsup). Rejected: bundling the `.d.ts` across package boundaries fought the tooling (dangling references, finicky rollup). Collapsing to folders removes the boundary entirely, so plain `tsc` suffices.
