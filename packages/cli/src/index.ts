#!/usr/bin/env node

import { createServer, build as viteBuild } from "vite"
import { extro } from "@extro/vite-plugin"
import { loadConfig } from "./load-config.js"

const command = process.argv[2]
const root = process.cwd()

const dev = async () => {
  const config = await loadConfig(root)

  const server = await createServer({
    root,
    plugins: [extro({ root, config })],
  })

  await server.listen()

  console.log("Extro dev server running")
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
