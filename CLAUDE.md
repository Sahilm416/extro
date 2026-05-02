# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Extro is a "Next.js for Chrome extensions" framework: file-based entrypoints under `src/app/`, automatic Manifest V3 generation, and React routing — all driven by a single Vite plugin. pnpm workspace + Turborepo, ESM-only, TypeScript strict. Package manager is `pnpm@10.15.1`.

## Commands

Run from the repo root:

```bash
pnpm build          # turbo build (excludes @extro/docs)
pnpm build:docs     # turbo build --filter=@extro/docs
pnpm dev            # turbo dev (tsc -w in every package)
pnpm typecheck      # turbo typecheck
pnpm lint           # turbo lint
```

Per-package: every package uses `tsc` directly — `pnpm --filter @extro/vite-plugin build` (or `dev` / `typecheck`). There is no test runner configured.

To exercise the framework end-to-end, use the example extension:

```bash
cd examples/basic
pnpm dev            # runs `extro dev` from the workspace CLI
pnpm build          # writes examples/basic/dist/, load unpacked in Chrome
```

`extro dev` does an initial `viteBuild` (so `background.js` / `content.js` exist on disk for Chrome) then starts a Vite dev server and overwrites the manifest + HTML shells with dev versions pointing at `http://localhost:<port>`. SIGINT/SIGTERM trigger a final production rebuild so the loaded extension keeps working after the dev server is gone.

## Architecture

The framework is the Vite plugin. The CLI is a thin wrapper, and `@extro/react` provides the runtime that the plugin's generated code imports.

### Packages

- **`extro`** (`packages/cli`) — bin entry. Loads `extro.config.ts` via jiti, runs `viteBuild` or `createServer` with the plugin. Also re-exports `defineConfig` from `./config`.
- **`@extro/vite-plugin`** — the framework. Entry detection, route scanning, manifest + HTML generation, and per-surface virtual runtime modules.
- **`@extro/react`** — `createExtroRouter` and hooks (`useLocation`, `useParams`, `useRouter`, `useSearchParams`). Imported by the generated runtime modules; users typically import only the hooks.
- **`@extro/types`** — `ManifestV3` and `ExtroConfig` shapes. Pure types, no runtime.
- **`@extro/core`** — placeholder for future runtime/messaging utilities. Currently empty surface.

### How a build is wired together

1. **Entry detection** (`vite-plugin/src/entries.ts`) globs `src/app/{popup,options,sidepanel}/page.{ts,tsx}` and `src/app/{background,content}/index.{ts,tsx}`. Result is `Partial<Record<ExtensionEntry, string>>` keyed by surface.
2. **Rollup input rewriting** (`vite-plugin/src/index.ts` `config()`): for each routable surface (`popup`, `options`, `sidepanel`), the input is replaced with the virtual ID `virtual:extro/runtime/<surface>` instead of the user's `page.tsx`. Background/content stay pointing at the user's file. `entryFileNames: "[name].js"` keeps Chrome-compatible deterministic names — no hashes.
3. **Virtual modules** (`vite-plugin/src/runtimes/*`):
   - `virtual:extro/runtime/<surface>` — emits a tiny shim that calls `createExtroRouter(routes, { surface })`. Persists the handle on `import.meta.hot.data` so HMR doesn't re-mount via `createRoot` twice; on routes-module HMR it calls `handle.update(routes)`.
   - `virtual:extro/routes/<surface>` — emits an array literal of `{ type, path, load: () => import("...") }` objects, with regex literals for dynamic routes (so the runtime can `.exec()` directly).
4. **Route scanning** (`vite-plugin/src/routes.ts`) builds the routes array from `src/app/<surface>/**/page.{ts,tsx}`. `[id]` segments become `:id` param keys with capture groups. **Sort order is load-bearing**: statics before dynamics (so exact matches aren't shadowed), longest-first within each group, alphabetical tiebreak for filesystem-stable output.
5. **`generateBundle()`** emits `manifest.json` and one `<surface>.html` per HTML surface, plus icons.

### Dev mode

`packages/cli/src/dev-assets.ts` writes `manifest.json` and `<surface>.html` directly to `dist/` (bypassing Vite output) so they reference `http://localhost:<port>/<entry>` and the manifest CSP allows that origin + ws origin. Background/content scripts come from the initial `viteBuild`. The plugin re-exports `findExtensionEntries`, `generateManifest`, `generateHTML`, and the surface constants via `@extro/vite-plugin/internal` for the CLI to consume.

### Routing runtime

`@extro/react/router` is hash-based (`window.location.hash`). `createExtroRouter` mounts once via `createRoot`, listens for `hashchange`, matches against the routes array, lazy-imports the page module, and renders inside `RouterContext.Provider`. A `navToken` counter discards stale renders if a fast navigation lands while a previous import is still in flight. `router.replace` manually dispatches `HashChangeEvent` because `history.replaceState` alone doesn't fire it.

### Manifest generation

`vite-plugin/src/manifest.ts`. Sources fields from `extro.config.ts` first, then `package.json`. Permissions/hostPermissions fall back to sane defaults (`storage` if background, `<all_urls>` if content) only when the user hasn't supplied them. `config.manifest` is `Object.assign`'d last as a full escape hatch.

## Conventions worth knowing

- All packages are `"type": "module"`; imports inside the source must use the `.js` extension (TS resolves it). The `tsconfig.base.json` uses `moduleResolution: "Bundler"`.
- Adding a new routable surface means updating `ROUTABLE_SURFACES` and `HTML_SURFACES` in `vite-plugin/src/constants.ts` — the plugin, route scanner, and runtime module generator all key off these.
- The CLI's `dev` command does NOT yet have a build-watch sidecar for background/content; changes to those files require restarting `extro dev` (see comment in `packages/cli/src/index.ts`).
- `apps/docs` is a Fumadocs site and is excluded from the default `pnpm build` until the API stabilizes.
