# @extro/react

React runtime and hooks for [Extro](https://github.com/Sahilm416/extro). Provides the router and hooks (`useLocation`, `useParams`, `useRouter`, `useSearchParams`) used by Chrome extension pages.

Installed automatically as a dependency of [`@extro/cli`](https://www.npmjs.com/package/@extro/cli).

## Usage

```tsx
import { useRouter, useParams } from "@extro/react/router"

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
