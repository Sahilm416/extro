# extrojs

## 0.3.1

### Patch Changes

- Stop the dev HTML shells from flashing the "Dev server isn't running" screen on every popup, options, or sidepanel open. The screen now ships hidden, and a small probe script (`extro-dev.js`, emitted into the dev output dir) reveals it only when the Vite dev server is actually unreachable.

## 0.3.0

### Minor Changes

- Single install surface. You install only `extrojs` and import the runtime through subpaths (`extrojs/link`, `extrojs/navigation`, `extrojs/asset`), mirroring the Next.js model. The router, `asset()`, env typing, and the Vite plugin (`extrojs/vite`) now live inside the one `extrojs` package; `react`/`react-dom` are optional peers, needed only for the React surfaces. The previous `@extrojs/*` packages are retired. See ADR 0009.

## 0.2.0

### Minor Changes

- 8eb1140: Reorganize the public packages and add a `Link` component.
  - **New `@extrojs/router`.** The router now lives in its own package and gains a `Link` component for hash-route navigation (`<Link href="/settings">`), alongside the existing hooks (`useRouter`, `useLocation`, `useParams`, `useSearchParams`).
  - **New `@extrojs/core`.** Surface-agnostic runtime helpers, starting with `asset()`. No React dependency, so background and content scripts can import it.
  - **`@extrojs/react` is now the base React runtime** (ambient `import.meta.env` typing). `@extrojs/router` re-exports it, so importing the router is still enough to type env with no setup.

  Breaking changes:
  - `import { ... } from "@extrojs/react/router"` is now `import { ... } from "@extrojs/router"`.
  - The router hooks are no longer exported from the `@extrojs/react` root. Import them from `@extrojs/router`.
  - `import { asset } from "extrojs/asset"` is now `import { asset } from "@extrojs/core"`.

### Patch Changes

- Updated dependencies [8eb1140]
  - @extrojs/vite-plugin@0.2.0
  - @extrojs/types@0.2.0
