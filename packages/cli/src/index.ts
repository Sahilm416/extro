#!/usr/bin/env node

import path from "node:path"
import { createServer, build as viteBuild } from "vite"
import { WebSocketServer } from "ws"
import { extro } from "@extro/vite-plugin"
import react from "@vitejs/plugin-react"
import { scanAppTree, type AppTree } from "@extro/vite-plugin/internal"
import { loadConfig } from "./load-config.js"
import { writeDevAssets } from "./dev-assets.js"

const command = process.argv[2]
const root = process.cwd()

// Separate output dirs let dev artifacts (with the bridge installed) persist
// across `extro dev` sessions without needing a prod-restore on shutdown.
const devOutDir = path.join(root, ".output", "chrome-mv3-dev")
const prodOutDir = path.join(root, ".output", "chrome-mv3-prod")

const dev = async () => {
  const config = await loadConfig(root)

  // 1. Scan once up front so we can decide what to start.
  const tree = await scanAppTree(root)
  validateTree(tree)

  // 2. Signal WS — the dev bridge in the extension's BG SW connects here.
  //    Fixed port (not :0) so the port baked into a previously-loaded BG SW
  //    keeps working across `extro dev` restarts — otherwise users have to
  //    refresh the extension every time to pick up a new random port.
  const signalPort = 9012
  const wss = new WebSocketServer({ port: signalPort })
  wss.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n[extro] Signal port ${signalPort} is in use — is another \`extro dev\` already running?\n`,
      )
      process.exit(1)
    }
    throw err
  })
  await once(wss, "listening")
  const broadcast = (msg: object) => {
    const payload = JSON.stringify(msg)
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload)
    }
  }

  // 3. Vite dev server for routable surfaces.
  //    `broadcastHmr` lets the plugin push HMR updates over our signal WS —
  //    we can't piggy-back on Vite's own HMR WS because its origin check
  //    rejects chrome-extension:// service workers.
  const server = await createServer({
    root,
    plugins: [
      react(),
      extro({
        root,
        config,
        broadcastHmr: (payload) => broadcast({ kind: "vite-hmr", payload }),
      }),
    ],
    server: { cors: true },
  })
  await server.listen()
  const addr = server.httpServer?.address()
  const port =
    addr && typeof addr === "object" ? addr.port : server.config.server.port ?? 5173

  // 4. Dev manifest + HTML + icons.
  await writeDevAssets({ tree, root, outDir: devOutDir, port, signalPort, config })

  // 5. Warn when new entrypoint files appear mid-session.
  watchForNewEntries({ server, root, tree })

  // 6. Build-watch sidecar for background + content. Always runs in dev so
  //    the dev bridge gets bundled into background.js (even if the user has
  //    no BG of their own).
  const watcher = await viteBuild({
    root,
    plugins: [extro({ root, config, scriptsOnly: true, devBridge: { signalPort } })],
    // emptyOutDir: false so the watcher doesn't wipe the manifest / HTML /
    // icons that writeDevAssets just put down.
    build: { watch: {}, emptyOutDir: false, outDir: devOutDir },
    logLevel: "error",
  })

  // The watcher is a RollupWatcher; bundle events fire on every rebuild
  // (including the first one). Broadcast on each so the bridge reloads.
  if (watcher && typeof (watcher as any).on === "function") {
    ;(watcher as any).on("event", (event: { code: string }) => {
      if (event.code === "BUNDLE_END") {
        broadcast({ kind: "scripts-rebuilt" })
      }
    })
  }

  console.log(`\nExtro dev server: http://localhost:${port}`)
  console.log(`Load unpacked extension from: ${devOutDir}\n`)

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) {
      console.log("\nAlready shutting down, please wait...")
      return
    }
    shuttingDown = true

    console.log("\nShutting down dev server...")
    if (watcher && typeof (watcher as any).close === "function") {
      await (watcher as any).close()
    }
    wss.close()
    await server.close()

    // No prod-restore: dev artifacts live in their own .output/chrome-mv3-dev
    // dir so the loaded extension stays untouched. Run `extro build` for a
    // standalone prod bundle in .output/chrome-mv3-prod.
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

const validateTree = (tree: AppTree) => {
  const empty =
    Object.keys(tree.scripts).length === 0 &&
    Object.keys(tree.surfaces).length === 0
  if (!empty) return
  throw new Error(
    "Extro: No extension entrypoints found.\n\nExpected files like:\n  src/app/popup/page.tsx\n  src/app/options/page.tsx\n  src/app/sidepanel/page.tsx\n  src/app/background/index.ts\n  src/app/content/index.ts",
  )
}

const ENTRY_PATTERN = /^src\/app\/([^/]+)\/(?:.+\/)?(?:page|index)\.tsx?$/

interface WatchForNewEntriesOptions {
  server: { watcher: { add: (p: string) => void; on: (e: string, cb: (file: string) => void) => void } }
  root: string
  tree: AppTree
}

const watchForNewEntries = ({ server, root, tree }: WatchForNewEntriesOptions) => {
  server.watcher.add(path.join(root, "src/app/**/{page,index}.{ts,tsx}"))

  server.watcher.on("add", (file) => {
    const rel = path.relative(root, file).split(path.sep).join("/")
    const match = rel.match(ENTRY_PATTERN)
    if (!match) return

    const surface = match[1]
    const known =
      (surface === "background" && !!tree.scripts.background) ||
      (surface === "content" && !!tree.scripts.content) ||
      (surface in tree.surfaces && !!tree.surfaces[surface as keyof typeof tree.surfaces])

    // Same surface, deeper page — also a new route. Warn unless it's the
    // exact file we already knew about.
    const content = tree.scripts.content
    const isExisting =
      (surface === "background" && tree.scripts.background?.endsWith(rel)) ||
      (surface === "content" &&
        (content?.script?.endsWith(rel) || content?.csui?.endsWith(rel)))
    if (isExisting) return

    if (!known || surface === "popup" || surface === "options" || surface === "sidepanel") {
      console.log(`\n[extro] New entrypoint detected: ${rel}`)
      console.log(`        Restart \`extro dev\` to pick it up.\n`)
    }
  })
}

const once = (emitter: { once: (e: string, cb: () => void) => void }, event: string) =>
  new Promise<void>((resolve) => emitter.once(event, () => resolve()))

const build = async () => {
  console.log("Building extension...")

  const config = await loadConfig(root)

  await viteBuild({
    root,
    plugins: [react(), extro({ root, config })],
    build: { outDir: prodOutDir },
  })

  console.log(`Build complete. Load unpacked extension from: ${prodOutDir}`)
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
