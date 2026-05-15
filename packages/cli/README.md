# extrojs

> Next.js for Chrome extensions.

File-based entrypoints, automatic Manifest V3 generation, and type-safe routing for popup / options / sidepanel surfaces, driven by a single Vite plugin. ESM-only, React, MV3.

> **Status:** pre-stable. APIs may change between releases.

## Install

```bash
pnpm add -D extrojs
pnpm add react react-dom
```

## Quick start

```bash
extro dev      # dev server with HMR, writes .output/chrome-mv3-dev/
extro build    # production build to .output/chrome-mv3-prod/
```

Load `.output/chrome-mv3-dev/` (or `.output/chrome-mv3-prod/`) in Chrome via **Load Unpacked**.

## Docs and source

Full documentation, architecture notes, and the source tree live at [github.com/Sahilm416/extro](https://github.com/Sahilm416/extro).

## License

MIT
