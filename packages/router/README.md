# @extrojs/router

Hash-based router for [Extro](https://github.com/Sahilm416/extro). Provides `createExtroRouter` (wired up for you by the framework), the `Link` component, and the hooks (`useLocation`, `useParams`, `useRouter`, `useSearchParams`) used by Chrome extension pages.

Installed automatically as a dependency of [`extrojs`](https://www.npmjs.com/package/extrojs).

## Usage

```tsx
import { Link, useParams, useRouter } from "@extrojs/router"

export default function UserPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  return (
    <div>
      <h1>User {id}</h1>
      <Link href="/">Home</Link>
      <button onClick={() => router.back()}>Back</button>
    </div>
  )
}
```

`Link` renders a real `<a href="#/...">` and prepends the `#` for you, so you never hand-write hash URLs. Pass `replace` to swap the current history entry instead of pushing a new one.

## Docs

[github.com/Sahilm416/extro](https://github.com/Sahilm416/extro)

## License

MIT
