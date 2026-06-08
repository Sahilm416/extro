<div align="center">
  <img src=".github/logo.svg" alt="Extro" width="72" height="72" />
  <h1>Extro</h1>
  <p><strong>Next.js for Chrome extensions.</strong></p>
  <p>
    File-based entrypoints, automatic Manifest V3 generation, and type-safe React routing,<br />
    all driven by a single Vite plugin.
  </p>
  <p>
    <a href="https://www.npmjs.com/package/extrojs"><img src="https://img.shields.io/npm/v/extrojs?style=flat-square" alt="npm version" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/npm/l/extrojs?style=flat-square" alt="license" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/extrojs?style=flat-square" alt="node version" /></a>
    <img src="https://img.shields.io/badge/status-pre--stable-orange?style=flat-square" alt="status: pre-stable" />
  </p>
</div>

> **Status:** pre-stable. The API surface is small and stabilizing, and it may change between releases.

## What is Extro?

Chrome extensions are a step backwards in DX, and Manifest V3 made it worse: split bundles per surface, brittle CSP, content scripts that cannot reach your dev server, no first-class HMR. Extro takes the position that the framework should disappear into a single Vite plugin and a convention. `src/app/popup/page.tsx` is your popup, full stop.

Drop a file under `src/app/`, get a working extension surface:

```
src/app/
├── popup/
│   ├── page.tsx
│   ├── settings/page.tsx
│   └── user/[id]/page.tsx
├── options/
│   └── page.tsx
├── sidepanel/
│   └── page.tsx
├── content/
│   └── page.tsx        ← CSUI (React, shadow DOM)
└── background/
    └── index.ts
```

Extro scans the tree, generates the manifest, wires up routing, and bundles everything into a Chrome-loadable directory.

## Features

- **File-based routing** for popup, options, and sidepanel. Hash-based router with dynamic `[id]` segments, type-safe params, a `Link` component, and the hooks you expect (`useRouter`, `useLocation`, `useParams`, `useSearchParams`).
- **Manifest V3, generated.** Surfaces, permissions, host matches, CSP, icons. Inferred from the tree and `extro.config.ts`, with a full escape hatch.
- **Real HMR.** React Fast Refresh with state preservation across popup, options, and sidepanel. Content-script UIs soft-remount without reloading the host page.
- **Content-script UIs.** Drop `src/app/content/page.tsx` and Extro mounts your React component into a shadow DOM on every matching page.
- **One Vite plugin.** No custom bundler, no per-surface build configs. Vite handles the dev server; the Extro plugin handles entries, virtual modules, and assets.
- **Persistent dev session.** Dev and prod outputs live in separate `output/` subdirs, so the dev bridge stays installed across `extro dev` restarts. No manual extension reload between sessions.

## Quick start

Scaffold a new extension (Node.js 20+) with `create-extro`. It writes a project, optionally installs dependencies, and initializes git:

```bash
pnpm create extro
# npm create extro@latest
# yarn create extro
# bun create extro
```

It scaffolds a popup and a background service worker. Add an options page, side panel, or content-script UI by dropping a file under `src/app/`. Then `cd` in and run `extro dev`.

Or add Extro to an existing project. You add one Extro package; `react` and `react-dom` are peer dependencies for the React surfaces:

```bash
pnpm add extrojs react react-dom
```

Add a config and your first surface:

```ts
// extro.config.ts
import { defineConfig } from "extrojs"

export default defineConfig({
  name: "My Extension",
  description: "A Chrome extension built with Extro.",
  permissions: ["storage"],
})
```

```tsx
// src/app/popup/page.tsx
import { Link } from "extrojs/link"
import { useRouter } from "extrojs/navigation"
import { asset } from "extrojs/asset"

export default function Popup() {
  const router = useRouter()

  return (
    <div>
      <img src={asset("logo.svg")} width={24} height={24} alt="" />
      <h1>My Extension</h1>
      <Link href="/settings">Settings</Link>
      <button onClick={() => router.push("/about")}>About</button>
    </div>
  )
}
```

Run the dev server, then load the unpacked extension:

```bash
extro dev    # writes output/chrome-mv3-dev/, starts Vite with HMR
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `output/chrome-mv3-dev/`

Edits to `src/app/` hot-reload with state preserved. For a production bundle, run `extro build` (output lands in `output/chrome-mv3-prod/`).

You install only `extrojs`. App code imports from its subpaths (`extrojs/link` for `Link`, `extrojs/navigation` for the routing hooks, `extrojs/asset` for `asset()`); `extrojs` itself is the CLI and `defineConfig`. See the [Installation guide](apps/docs/content/docs/installation.mdx) for the full walkthrough.

## Try the example

The repo ships a reference extension that exercises every surface:

```bash
git clone https://github.com/Sahilm416/extro.git
cd extro
pnpm install

cd examples/basic
pnpm dev
```

Load `examples/basic/output/chrome-mv3-dev/` in Chrome, as above.

## Documentation

The full documentation lives in [`apps/docs/`](apps/docs/content/docs) and is built with Fumadocs. Until the API stabilizes and the site is hosted, run it locally:

```bash
pnpm --filter @extrojs/docs dev
```

## Packages

Extro is an ESM-only, TypeScript pnpm + Turborepo monorepo.

[`extrojs`](https://www.npmjs.com/package/extrojs) (in `packages/extrojs`) is the one published package — everything users install. It exposes the `extro` CLI, `defineConfig`, and the runtime subpaths (`extrojs/link`, `extrojs/navigation`, `extrojs/asset`, plus `extrojs/vite` for manual Vite setups).

Inside `packages/extrojs/src/`: the CLI at the root, `plugin/` (the Vite plugin), `router/` (`Link`, hooks, `createExtroRouter`), `core/` (`asset()`), `react/` (env typing), `types/` (shared types), and `exports/` (the subpath entry files). They were separate `@extrojs/*` packages before 0.3.0; see ADR 0009.

[`create-extro`](https://www.npmjs.com/package/create-extro) (in `packages/create-extro`) is the scaffolder behind `pnpm create extro`. It is run, not installed: it copies one of the curated `templates/` into a new directory, so a generated project still depends only on `extrojs`. See ADR 0011.

## Contributing

Issues and pull requests are welcome. Extro is pre-stable, so the API can still move; opening an [issue](https://github.com/Sahilm416/extro/issues) before a large change is the fastest path to getting it merged.

```bash
pnpm install      # install the workspace
pnpm dev          # tsc -w across every package
pnpm build        # build all packages (excludes the docs site)
pnpm test         # run the Vitest suites
pnpm typecheck    # type-check everything
pnpm lint         # lint
```

The [`examples/basic`](examples/basic) extension is the end-to-end test bed: run `pnpm dev` inside it and load the unpacked output in Chrome to verify a change against a real extension.

## License

[MIT](./LICENSE) © Sahil Mulani
