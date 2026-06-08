// Ambient types for Extro's env. Opt in from a project by adding:
//   /// <reference types="extrojs/client" />
// Public env vars (EXTRO_PUBLIC_*) are inlined into every surface via
// import.meta.env. See ADR 0002.

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
