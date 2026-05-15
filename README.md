<h1>
  <img src=".github/logo.svg" alt="extro" width="44" height="44" align="absmiddle" />
  &nbsp;extro
</h1>

> Next.js for Chrome extensions.

File-based entrypoints, automatic Manifest V3 generation, and type-safe routing for popup / options / sidepanel surfaces, driven by a single Vite plugin. ESM-only, React, MV3.

> **Status:** pre-stable. APIs may change between releases.

## Quick look

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

- **File-based routing** for popup, options, and sidepanel. Hash-based router with dynamic `[id]` segments, type-safe params, and the hooks you expect.
- **Manifest V3, generated.** Surfaces, permissions, host matches, CSP, icons. Inferred from the tree and `extro.config.ts`, with a full escape hatch.
- **Real HMR.** React Fast Refresh with state preservation across popup / options / sidepanel. Content-script UIs soft-remount without reloading the host page.
- **Content-script UIs.** Drop `src/app/content/page.tsx` and Extro mounts your React component into a shadow DOM on every matching page.
- **One Vite plugin.** No custom bundler, no per-surface build configs. Vite handles the dev server; the Extro plugin handles entries, virtual modules, and assets.
- **Persistent dev session.** Dev and prod outputs live in separate `.output/` subdirs, so the dev bridge stays installed across `extro dev` restarts. No manual extension reload between sessions.

## Getting started

Clone and run the example extension:

```bash
git clone https://github.com/Sahilm416/extro.git
cd extro
pnpm install

cd examples/basic
pnpm dev
```

Then load the unpacked extension in Chrome:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click **Load unpacked**
4. Select `examples/basic/.output/chrome-mv3-dev/` (press `Cmd+Shift+.` on macOS to reveal the dotfolder)

For a production bundle:

```bash
pnpm build
# output lands in .output/chrome-mv3-prod/
```

## Documentation

The full documentation lives in `apps/docs/` and is built with Fumadocs. Until the API stabilizes, run the docs site locally:

```bash
pnpm --filter @extrojs/docs dev
```

## Repository

```
apps/
  docs/            Documentation site
packages/
  cli/             The `extro` CLI
  vite-plugin/     Framework core (entry detection, manifest, routing)
  react/           Router runtime and hooks
  types/           Shared TypeScript types
examples/
  basic/           Reference extension
```

## License

MIT
