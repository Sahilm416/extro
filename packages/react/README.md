# @extrojs/react

React runtime and hooks for [Extro](https://github.com/Sahilm416/extro). Provides the router and hooks (`useLocation`, `useParams`, `useRouter`, `useSearchParams`) used by Chrome extension pages.

Installed automatically as a dependency of [`extrojs`](https://www.npmjs.com/package/extrojs).

## Usage

```tsx
import { useRouter, useParams } from "@extrojs/react/router"

export default function UserPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  return <button onClick={() => router.push("/")}>← back</button>
}
```

## Docs

[github.com/Sahilm416/extro](https://github.com/Sahilm416/extro)

## License

MIT
