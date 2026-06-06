import { loadEnv } from "vite"

/**
 * @describe Loads `.env` files into `process.env` before config is read, so
 * `extro.config.ts` and manifest generation (the build-time env tier) can see
 * them. Uses Vite's own `loadEnv` with an empty prefix (all vars, same
 * stacking as `import.meta.env`), and does NOT override existing keys, so real
 * process env (CI) wins over `.env` files. The public tier (`EXTRO_PUBLIC_*`
 * via `import.meta.env`) is handled separately by Vite's `envPrefix`. See ADR
 * 0002.
 */
export const loadEnvIntoProcess = (
  root: string,
  mode: "development" | "production",
) => {
  const env = loadEnv(mode, root, "")
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
