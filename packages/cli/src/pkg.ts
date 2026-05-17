import { readFileSync } from "node:fs"

interface Pkg {
  name: string
  version: string
}

// Read at runtime rather than `import`ing package.json: it lives outside
// `rootDir: src`, so tsc would reject a static import. The URL resolves the
// same in the workspace (dist/pkg.js -> ../package.json) and once published.
export const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as Pkg
