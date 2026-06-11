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
  <p>
    <a href="https://extro-docs.vercel.app/docs/guide"><strong>Documentation</strong></a> ·
    <a href="https://extro-docs.vercel.app/docs/guide/quick-start">Quick Start</a> ·
    <a href="https://extro-docs.vercel.app/docs/reference">API Reference</a>
  </p>
</div>

## What is Extro?

Drop a file under `src/app/`, get a working extension surface. Extro scans the tree, generates the manifest, wires up routing, and bundles everything into a Chrome-loadable directory.

```
src/app/
├── popup/
│   ├── page.tsx
│   └── settings/page.tsx
├── options/
│   └── page.tsx
├── sidepanel/
│   └── page.tsx
├── content/
│   └── page.tsx        ← CSUI (React, shadow DOM)
└── background/
    └── index.ts
```

- **File-based routing** for popup, options, and sidepanel: dynamic `[id]` segments, layouts, error boundaries, a `Link` component, and type-safe hooks.
- **Manifest V3, generated.** Surfaces, permissions, host matches, CSP, and icons inferred from the tree and `extro.config.ts`, with a full escape hatch.
- **Real HMR.** React Fast Refresh with state preservation across every HTML surface; content-script UIs soft-remount without reloading the host page.
- **One Vite plugin.** No custom bundler, no per-surface build configs.

## Getting started

```bash
pnpm create extro my-extension
cd my-extension && pnpm dev
```

Then open `chrome://extensions`, enable **Developer mode**, and **Load unpacked** the `output/chrome-mv3-dev/` directory.

See the [Quick Start](https://extro-docs.vercel.app/docs/guide/quick-start) for the full walkthrough, including adding Extro to an existing project.

## Documentation

The full documentation lives at [extro-docs.vercel.app](https://extro-docs.vercel.app/docs/guide): an ordered [Guide](https://extro-docs.vercel.app/docs/guide) from install to production build, and an [API Reference](https://extro-docs.vercel.app/docs/reference) covering every public API.

## Packages

| Package | Description |
| --- | --- |
| [`extrojs`](https://www.npmjs.com/package/extrojs) | The framework: the `extro` CLI, the Vite plugin, and the runtime subpaths. The only package you install. |
| [`create-extro`](https://www.npmjs.com/package/create-extro) | The scaffolder behind `pnpm create extro`. |

## Contributing

Issues and pull requests are welcome. Extro is pre-stable, so the API can still move; opening an [issue](https://github.com/Sahilm416/extro/issues) before a large change is the fastest path to getting it merged.

```bash
pnpm install && pnpm build && pnpm test
```

The [`examples/basic`](examples/basic) extension is the end-to-end test bed: run `pnpm dev` inside it and load the unpacked output in Chrome to verify a change against a real extension.

## License

[MIT](./LICENSE) © Sahil Mulani
