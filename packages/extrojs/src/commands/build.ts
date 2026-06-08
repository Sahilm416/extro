import { build as viteBuild } from "vite"
import { extro } from "../plugin/index.js"
import react from "@vitejs/plugin-react"
import { loadConfig } from "../load-config.js"
import { loadEnvIntoProcess } from "../env.js"
import { outputDir } from "../paths.js"
import { createViteLogger, log } from "../logger.js"

/**
 * @describe Produces a standalone production bundle in
 * <outDir>/chrome-mv3-prod/: manifest, HTML shells, and script bundles.
 */
export const build = async () => {
  const root = process.cwd()

  log.info("Building extension for production...")

  loadEnvIntoProcess(root, "production")
  const config = await loadConfig(root)
  const prodOutDir = outputDir(root, config, "prod")

  await viteBuild({
    root,
    plugins: [react(), extro({ root, config })],
    build: { outDir: prodOutDir },
    customLogger: createViteLogger(),
  })

  log.success("Build complete")
  log.info(`Unpacked extension: ${prodOutDir}`)
}
