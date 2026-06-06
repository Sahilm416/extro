import type { ExtroConfig } from "@extrojs/types"

import fs from "node:fs/promises"
import path from "node:path"
import {
  type AppTree,
  emitAssets,
  collectPublicAssets,
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
  await copyPublic(root, outDir, tree)
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

/**
 * @describe Copies Public assets into the dev output dir so they resolve at
 * the extension origin in dev exactly as in prod (chrome.runtime.getURL, or a
 * root-relative ref on a routable surface). Mirrors copyIcons; the collision
 * guard from collectPublicAssets keeps a stray file from shadowing a
 * generated output.
 */
const copyPublic = async (root: string, outDir: string, tree: AppTree) => {
  const { files, conflicts } = collectPublicAssets(root, tree)

  for (const conflict of conflicts) {
    console.warn(
      `[extro] public/${conflict} collides with a generated output; skipping. Rename it to ship it.`,
    )
  }

  await Promise.all(
    files.map(async (rel) => {
      const dst = path.join(outDir, rel)
      await fs.mkdir(path.dirname(dst), { recursive: true })
      await fs.copyFile(path.join(root, "public", rel), dst)
    }),
  )
}
