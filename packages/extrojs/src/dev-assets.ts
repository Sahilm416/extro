import type { ExtroConfig } from "@extrojs/types"

import fs from "node:fs/promises"
import path from "node:path"
import {
  type AppTree,
  type PublicAssets,
  emitAssets,
  discoverAssets,
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
 * sidecar (a Vite watch-mode build), not here.
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

  // One discovery pass for the dev manifest, the icon copy, and the public
  // copy, mirroring the prod path. See the Asset inventory.
  const inventory = discoverAssets(root, tree)

  await emitAssets(
    { tree, inventory, pkg, config, dev: { port, signalPort } },
    (fileName, source) => fs.writeFile(path.join(outDir, fileName), source),
  )

  await copyIcons(root, outDir, inventory.icons)
  await copyPublic(root, outDir, inventory.public)
}

const copyIcons = async (
  root: string,
  outDir: string,
  icons: Record<string, string> | null,
) => {
  if (!icons) return
  const entries = Object.values(icons)
  if (entries.length === 0) return

  await fs.mkdir(path.join(outDir, "icons"), { recursive: true })
  await Promise.all(
    entries.map((rel) => fs.copyFile(path.join(root, rel), path.join(outDir, rel))),
  )
}

/**
 * @describe Copies Public assets into the dev output dir so they resolve at
 * the extension origin in dev exactly as in prod (chrome.runtime.getURL, or a
 * root-relative ref on a routable surface). Mirrors copyIcons; the collision
 * guard from the Asset inventory keeps a stray file from shadowing a
 * generated output.
 */
const copyPublic = async (root: string, outDir: string, publicAssets: PublicAssets) => {
  const { files, conflicts } = publicAssets

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
