// Global typing for Extro's public env. Loaded transitively whenever a project
// imports @extrojs/react (or @extrojs/react/router), so `import.meta.env` is
// typed with no setup. EXTRO_PUBLIC_* is inlined into surfaces (ADR 0002).
// Background-only code that imports nothing from the framework can instead add:
//   /// <reference types="extrojs/client" />
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
