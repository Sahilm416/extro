---
"extrojs": minor
"@extrojs/router": minor
"@extrojs/core": minor
"@extrojs/react": minor
"@extrojs/vite-plugin": minor
"@extrojs/types": minor
---

Single install surface. You install only `extrojs` and import the runtime through subpaths (`extrojs/link`, `extrojs/navigation`, `extrojs/asset`), mirroring the Next.js model. `extrojs` re-exports the scoped `@extrojs/*` packages, which stay published and arrive transitively; `react`/`react-dom` are optional peers, needed only for the React surfaces. See ADR 0009.
