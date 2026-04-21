import type { ExtroConfig } from "@extro/types"
import { createJiti } from "jiti"
import fs from "node:fs"
import path from "node:path"

const CONFIG_FILENAMES = ["extro.config.ts", "extro.config.js"]

export const loadConfig = async (root: string): Promise<ExtroConfig> => {
  const configPath = CONFIG_FILENAMES
    .map((name) => path.join(root, name))
    .find((p) => fs.existsSync(p))

  if (!configPath) return {}

  const jiti = createJiti(root, { interopDefault: true })
  const mod = await jiti.import<ExtroConfig | { default: ExtroConfig }>(configPath)

  return "default" in (mod as object) ? (mod as { default: ExtroConfig }).default : (mod as ExtroConfig)
}
