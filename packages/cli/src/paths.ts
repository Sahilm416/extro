import path from "node:path"
import type { ExtroConfig } from "@extrojs/types"

/**
 * @describe Resolved unpacked-extension output dir for a build mode. The base
 * comes from `config.outDir` (default `output`, resolved against the project
 * root); the `chrome-mv3-<mode>` subdir keeps dev and prod artifacts separate
 * and leaves room for other targets later.
 */
export const outputDir = (
  root: string,
  config: ExtroConfig,
  mode: "dev" | "prod",
) => path.join(path.resolve(root, config.outDir ?? "output"), `chrome-mv3-${mode}`)
