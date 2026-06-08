# create-extro

The scaffolder for [Extro](https://github.com/Sahilm416/extro), a framework for building Chrome extensions with file-based entrypoints, automatic Manifest V3 generation, and React routing.

## Usage

```bash
pnpm create extro
# npm create extro@latest
# yarn create extro
# bun create extro
```

Answer the prompts, or pass a directory and skip them:

```bash
pnpm create extro my-extension --template minimal
```

Then start the dev server and load the unpacked extension:

```bash
cd my-extension
pnpm install   # if you skipped the install step
extro dev      # writes output/chrome-mv3-dev, starts Vite with HMR
```

Open `chrome://extensions`, turn on Developer mode, and **Load unpacked** the `output/chrome-mv3-dev` directory.

## What you get

A clean starting point: a popup and a background service worker, plus `extro.config.ts`, icons, and a TypeScript setup. Nothing you have to delete.

Extro is file-based, so you grow it by dropping a file under `src/app/`:

- `options/page.tsx` - the options page
- `sidepanel/page.tsx` - the side panel
- `content/page.tsx` - a content-script UI (React, shadow DOM)
- `popup/settings/page.tsx`, `popup/[id]/page.tsx` - nested and dynamic routes

See the [Extro docs](https://github.com/Sahilm416/extro) for routing, layouts, and the manifest reference.

## Options

```
create-extro [directory] [options]

  -t, --template <name>   Template to use: default
      --pm <manager>      Force a package manager: npm, pnpm, yarn, bun
      --install           Install dependencies
      --no-install        Skip installing dependencies
      --git               Initialize a git repository
      --no-git            Skip git initialization
      --overwrite         Overwrite the target directory if it is not empty
  -y, --yes               Accept defaults and skip the prompts
  -h, --help              Show this help
  -v, --version           Show the version
```

When the terminal is not interactive (CI, piped output) or `--yes` is passed, the prompts are skipped and flags plus defaults drive the run.

## License

[MIT](https://github.com/Sahilm416/extro/blob/main/LICENSE) © Sahil Mulani
