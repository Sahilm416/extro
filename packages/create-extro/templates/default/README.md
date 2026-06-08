# Extro extension

An extension scaffolded with [Extro](https://github.com/Sahilm416/extro): file-based entrypoints, automatic Manifest V3 generation, and React routing, all driven by a single Vite plugin.

## Develop

```bash
pnpm dev
```

`extro dev` starts a Vite dev server with HMR and writes an unpacked extension to `output/chrome-mv3-dev`. Open `chrome://extensions`, turn on Developer mode, and load that directory with **Load unpacked**. It stays loaded across dev restarts, so there is no manual reload between sessions.

## Build

```bash
pnpm build
```

Writes a production bundle to `output/chrome-mv3-prod`, ready to load or zip for the Chrome Web Store.

## Project layout

This starter ships two surfaces. Add more by dropping a file under `src/app/`:

```
src/app/
├── popup/page.tsx        the toolbar popup
└── background/index.ts   the background service worker
```

Add `options/page.tsx`, `sidepanel/page.tsx`, or `content/page.tsx` to grow into the other surfaces. Configure the generated manifest in `extro.config.ts`. See the [Extro docs](https://github.com/Sahilm416/extro) for the full reference.
