import path from "node:path"
import { build as viteBuild } from "vite"
import { extro } from "@extrojs/vite-plugin"
import react from "@vitejs/plugin-react"
import { loadConfig } from "../load-config.js"

/**
 * @describe Produces a standalone production bundle in
 * .output/chrome-mv3-prod/ — manifest, HTML shells, and script bundles.
 */
export const build = async () => {
  const root = process.cwd()
  const prodOutDir = path.join(root, ".output", "chrome-mv3-prod")

  console.log("Building extension...")

  const config = await loadConfig(root)

  await viteBuild({
    root,
    plugins: [react(), extro({ root, config })],
    build: { outDir: prodOutDir },
  })

  console.log(`Build complete. Load unpacked extension from: ${prodOutDir}`)
}
