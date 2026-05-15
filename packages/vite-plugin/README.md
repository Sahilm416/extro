# @extrojs/vite-plugin

Vite plugin powering [Extro](https://github.com/Sahilm416/extro): file-based entrypoints, automatic Manifest V3 generation, and React routing for Chrome extensions.

Most users should install the [`extrojs`](https://www.npmjs.com/package/extrojs) package instead of this plugin directly.

## Install

```bash
pnpm add -D @extrojs/vite-plugin
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from "vite"
import { extro } from "@extrojs/vite-plugin"

export default defineConfig({
  plugins: [extro()],
})
```

## Docs

[github.com/Sahilm416/extro](https://github.com/Sahilm416/extro)

## License

MIT
