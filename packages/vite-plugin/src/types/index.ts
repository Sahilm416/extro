export type { ManifestV3 } from "@extro/types"

export type PluginContextLike = {
  emitFile(file: {
    type: "asset"
    fileName: string
    source: string | Uint8Array
  }): string
}
