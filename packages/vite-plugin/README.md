# @extro/vite-plugin

Vite plugin powering [Extro](https://github.com/Sahilm416/extro): file-based entrypoints, automatic Manifest V3 generation, and React routing for Chrome extensions.

Most users should install the [`@extro/cli`](https://www.npmjs.com/package/@extro/cli) package instead of this plugin directly.

## Install

```bash
pnpm add -D @extro/vite-plugin
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from "vite"
import { extro } from "@extro/vite-plugin"

export default defineConfig({
  plugins: [extro()],
})
```

## Docs

[github.com/Sahilm416/extro](https://github.com/Sahilm416/extro)

## License

MIT
