import type { ExtroConfig } from "@extrojs/types"

import fs from "node:fs/promises"
import path from "node:path"
import {
  type AppTree,
  emitAssets,
} from "@extrojs/vite-plugin/internal"

interface WriteDevAssetsOptions {
  tree: AppTree
  root: string
  outDir: string
  port: number
  signalPort: number
  config: ExtroConfig
}

/**
 * @describe Writes the dev manifest + HTML shells + icons to disk so Chrome
 * can load the unpacked extension while the Vite dev server serves modules
 * over HTTP. Background/content scripts are written by the build-watch
 * sidecar (a Vite watch-mode build) — not here.
 */
export const writeDevAssets = async ({
  tree,
  root,
  outDir,
  port,
  signalPort,
  config,
}: WriteDevAssetsOptions) => {
  await fs.mkdir(outDir, { recursive: true })

  const pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf8").catch(() => "{}")
  const pkg = JSON.parse(pkgRaw)

  await emitAssets(
    { tree, root, pkg, config, dev: { port, signalPort } },
    (fileName, source) => fs.writeFile(path.join(outDir, fileName), source),
  )

  await copyIcons(root, outDir)
}

const copyIcons = async (root: string, outDir: string) => {
  const srcDir = path.join(root, "icons")
  const exists = await fs.stat(srcDir).then((s) => s.isDirectory()).catch(() => false)
  if (!exists) return

  const dstDir = path.join(outDir, "icons")
  await fs.mkdir(dstDir, { recursive: true })

  const files = await fs.readdir(srcDir)
  await Promise.all(
    files.map((f) => fs.copyFile(path.join(srcDir, f), path.join(dstDir, f))),
  )
}
