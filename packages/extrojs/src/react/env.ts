// Single source of Extro's public env typing. Loaded transitively whenever a
// project imports a routing subpath (extrojs/link / extrojs/navigation pull the
// router, which imports this), so `import.meta.env` is typed with no setup. The
// extrojs/client entry (client.d.ts) re-surfaces this same declaration for code
// that imports nothing else. EXTRO_PUBLIC_* is inlined into surfaces (ADR 0002).
export {}

declare global {
  interface ImportMetaEnv {
    readonly MODE: string
    readonly DEV: boolean
    readonly PROD: boolean
    readonly BASE_URL: string
    readonly [key: `EXTRO_PUBLIC_${string}`]: string | undefined
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
