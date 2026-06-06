# @extrojs/types

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
