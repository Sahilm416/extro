import type { ExtroConfig } from "@extro/types"

import fs from "node:fs/promises"
import path from "node:path"
import { scanAppTree, emitAssets } from "@extro/vite-plugin/internal"

interface WriteDevAssetsOptions {
  root: string
  outDir: string
  port: number
  config: ExtroConfig
}

/**
 * @describe Writes the dev manifest + HTML shells to disk so Chrome can load
 * the unpacked extension while the Vite dev server serves modules over HTTP.
 * Background/content bundles are not handled here — the build-watch sidecar
 * (added in a later step) writes those.
 */
export const writeDevAssets = async ({
  root,
  outDir,
  port,
  config,
}: WriteDevAssetsOptions) => {
  const tree = await scanAppTree(root)

  await fs.mkdir(outDir, { recursive: true })

  const pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf8").catch(() => "{}")
  const pkg = JSON.parse(pkgRaw)

  await emitAssets(
    { tree, root, pkg, config, dev: { port } },
    (fileName, source) => fs.writeFile(path.join(outDir, fileName), source),
  )
}
