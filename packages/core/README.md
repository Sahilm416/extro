# @extrojs/core

Surface-agnostic runtime helpers for [Extro](https://github.com/Sahilm416/extro). Works in every extension surface (popup, options, sidepanel, background, content).

Installed automatically as a dependency of [`extrojs`](https://www.npmjs.com/package/extrojs).

## Usage

```tsx
import { asset } from "extrojs/asset"

// Resolves a public asset to its extension URL on any surface, unlike a
// root-relative "/logo.svg" which resolves against a content script's host page.
<img src={asset("logo.svg")} />
```

## Docs

[github.com/Sahilm416/extro](https://github.com/Sahilm416/extro)

## License

MIT
