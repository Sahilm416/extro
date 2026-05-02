#!/usr/bin/env node

import path from "node:path"
import { createServer, build as viteBuild } from "vite"
import { extro } from "@extro/vite-plugin"
import { loadConfig } from "./load-config.js"
import { writeDevAssets } from "./dev-assets.js"

const command = process.argv[2]
const root = process.cwd()
const outDir = path.join(root, "dist")

const dev = async () => {
  const config = await loadConfig(root)

  // Initial build so background.js / content.js exist on disk for Chrome
  // to load. The Vite dev server below takes over for popup/options/sidepanel
  // (we overwrite their HTML + manifest with dev shells right after).
  // A proper build-watch sidecar replaces this in the next step.
  await viteBuild({
    root,
    plugins: [extro({ root, config })],
    logLevel: "error",
  })

  const server = await createServer({
    root,
    plugins: [extro({ root, config })],
    server: { cors: true },
  })

  await server.listen()

  const port = server.config.server.port ?? 5173

  await writeDevAssets({ root, outDir, port, config })

  console.log(`\nExtro dev server: http://localhost:${port}`)
  console.log(`Load unpacked extension from: ${outDir}\n`)

  const shutdown = async () => {
    console.log("\nShutting down dev server...")
    await server.close()

    console.log("Restoring production build...")
    await viteBuild({
      root,
      plugins: [extro({ root, config })],
      logLevel: "error",
    })

    console.log("Extension restored — it will keep working without the dev server.")
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

const build = async () => {
  console.log("Building extension...")

  const config = await loadConfig(root)

  await viteBuild({
    root,
    plugins: [extro({ root, config })],
  })

  console.log("Build complete")
}

switch (command) {
  case "dev":
    await dev()
    break

  case "build":
    await build()
    break

  case "init":
    console.log("Initializing Extro project...")
    break

  default:
    console.log("Extro CLI")
}
