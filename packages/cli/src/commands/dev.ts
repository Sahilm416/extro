import type { AppTree } from "@extrojs/vite-plugin/internal"

import { createServer, build as viteBuild } from "vite"
import { WebSocketServer } from "ws"
import { extro } from "@extrojs/vite-plugin"
import react from "@vitejs/plugin-react"
import { scanAppTree } from "@extrojs/vite-plugin/internal"
import { loadConfig } from "../load-config.js"
import { loadEnvIntoProcess } from "../env.js"
import { outputDir } from "../paths.js"
import { writeDevAssets } from "../dev-assets.js"
import { pkg } from "../pkg.js"
import { banner, createViteLogger, log } from "../logger.js"

const once = (
  emitter: { once: (e: string, cb: () => void) => void },
  event: string,
) => new Promise<void>((resolve) => emitter.once(event, () => resolve()))

/**
 * @describe Throws a helpful error when the user's src/app has no entrypoints,
 * so `extro dev` fails fast with guidance instead of starting an empty server.
 */
const validateTree = (tree: AppTree) => {
  const empty =
    Object.keys(tree.scripts).length === 0 &&
    Object.keys(tree.surfaces).length === 0
  if (!empty) return
  throw new Error(
    "Extro: No extension entrypoints found.\n\nExpected files like:\n  src/app/popup/page.tsx\n  src/app/options/page.tsx\n  src/app/sidepanel/page.tsx\n  src/app/background/index.ts\n  src/app/content/index.ts",
  )
}

/**
 * @describe Starts the Extro dev server: a Vite server for routable surfaces, a
 * signal WS the extension's BG SW connects to, and a build-watch sidecar for
 * background + content scripts. Writes the dev manifest/HTML into the dev
 * output dir and wires SIGINT/SIGTERM to a clean shutdown.
 */
export const dev = async () => {
  const root = process.cwd()

  loadEnvIntoProcess(root, "development")
  const config = await loadConfig(root)

  // Separate output dirs let dev artifacts (with the bridge installed) persist
  // across `extro dev` sessions without needing a prod-restore on shutdown.
  const devOutDir = outputDir(root, config, "dev")

  // 1. Scan once up front so we can decide what to start.
  const tree = await scanAppTree(root)
  validateTree(tree)

  // 2. Signal WS — the dev bridge in the extension's BG SW connects here.
  //    Fixed port (not :0) so the port baked into a previously-loaded BG SW
  //    keeps working across `extro dev` restarts — otherwise users have to
  //    refresh the extension every time to pick up a new random port.
  const signalPort = config.dev?.bridgePort ?? 9012
  const wss = new WebSocketServer({ port: signalPort })
  wss.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      log.error(
        `Signal port ${signalPort} is in use. Is another \`extro dev\` already running?`,
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
  const viteLogger = createViteLogger()

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
    server: { cors: true, port: config.dev?.port, strictPort: config.dev?.strictPort },
    // Keep the user's scrollback + our banner; Vite clears the terminal by
    // default on start and on each HMR.
    clearScreen: false,
    customLogger: viteLogger,
  })
  await server.listen()
  const addr = server.httpServer?.address()
  const port =
    addr && typeof addr === "object"
      ? addr.port
      : server.config.server.port ?? 5173

  // 4. Dev manifest + HTML + icons.
  await writeDevAssets({ tree, root, outDir: devOutDir, port, signalPort, config })

  // 5. Build-watch sidecar for background + content. Always runs in dev so
  //    the dev bridge gets bundled into background.js (even if the user has
  //    no BG of their own).
  const watcher = await viteBuild({
    root,
    // Same mode as the dev server (createServer defaults to development) so
    // background/content resolve the same .env set as the routables. Without
    // this the sidecar defaults to production and the scripts would load
    // .env.production while the popup loads .env.development. See ADR 0002.
    mode: "development",
    plugins: [extro({ root, config, scriptsOnly: true, devBridge: { signalPort, vitePort: port } })],
    // emptyOutDir: false so the watcher doesn't wipe the manifest / HTML /
    // icons that writeDevAssets just put down.
    build: { watch: {}, emptyOutDir: false, outDir: devOutDir },
    logLevel: "error",
  })

  // The watcher is a RollupWatcher. We split the rebuild signal by which
  // entry changed: a background-only edit must not reload tabs / remount
  // CSUI, and a content-only edit must not reload the extension. `change`
  // events (one per changed file) accumulate until the next `BUNDLE_END`;
  // a file outside both surface dirs (shared code) conservatively dirties
  // both. No classified change (initial build, or an `extro dev` restart)
  // also means both, matching the old broadcast-on-first-build behavior.
  if (watcher && typeof (watcher as any).on === "function") {
    const w = watcher as any
    let bgDirty = false
    let csDirty = false

    w.on("change", (id: string) => {
      const p = String(id).replace(/\\/g, "/")
      const isBg = p.includes("/src/app/background/")
      const isCs = p.includes("/src/app/content/")
      if (isBg) bgDirty = true
      if (isCs) csDirty = true
      if (!isBg && !isCs) {
        bgDirty = true
        csDirty = true
      }
    })

    w.on("event", (event: { code: string }) => {
      if (event.code !== "BUNDLE_END") return
      if (!bgDirty && !csDirty) {
        bgDirty = true
        csDirty = true
      }
      if (bgDirty) broadcast({ kind: "bg-rebuilt" })
      if (csDirty) broadcast({ kind: "cs-rebuilt" })
      bgDirty = false
      csDirty = false
    })
  }

  banner({
    mode: "dev",
    version: pkg.version,
    rows: [
      { label: "Server", value: `http://localhost:${port}` },
      { label: "Unpacked", value: devOutDir },
    ],
    hint: 'Load the unpacked dir in Chrome via "Load Unpacked".',
  })

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    process.off("SIGINT", shutdown)
    process.off("SIGTERM", shutdown)

    log.info("Shutting down dev server...")
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
