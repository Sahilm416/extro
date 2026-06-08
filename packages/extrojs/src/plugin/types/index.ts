export type { ManifestV3 } from "../../types/index.js"

export type PluginContextLike = {
  emitFile(file: {
    type: "asset"
    fileName: string
    source: string | Uint8Array
  }): string
  warn(message: string): void
}
