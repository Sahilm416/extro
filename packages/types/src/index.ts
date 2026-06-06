export interface ManifestV3 {
  manifest_version: 3
  name?: string
  description?: string
  version: string
  /** Base64 public key that pins the extension ID. Sourced from EXTRO_CRX_KEY. */
  key?: string
  action?: {
    default_popup: string
  }
  background?: {
    service_worker: string
  }
  content_scripts?: {
    matches: string[]
    js: string[]
  }[]
  host_permissions?: string[]
  permissions?: string[]
  options_ui?: {
    page: string
    open_in_tab?: boolean
  }
  side_panel?: {
    default_path: string
  }
  icons?: Record<string, string>
  content_security_policy?: {
    extension_pages?: string
    sandbox?: string
  }
  web_accessible_resources?: {
    resources: string[]
    matches: string[]
  }[]
  /**
   * Any other Manifest V3 field Extro does not model. Lets `manifest` and
   * `transformManifest` set arbitrary fields (e.g. `minimum_chrome_version`,
   * `commands`) without casting.
   */
  [key: string]: unknown
}

export interface ExtroConfig {
  // --- Identity (promoted manifest fields; fall back to package.json) ---
  name?: string
  version?: string
  description?: string
  icons?: Record<string, string>

  // --- Permissions (promoted) ---
  permissions?: string[]
  hostPermissions?: string[]

  /**
   * Per-surface configuration. Currently used for content scripts —
   * `content.matches` controls which URLs the content script (and CSUI)
   * is injected into. Defaults to `["<all_urls>"]`.
   */
  content?: {
    matches?: string[]
  }

  /**
   * Raw Manifest V3 fields merged over the promoted ones. The escape hatch
   * for anything Extro does not model.
   */
  manifest?: Partial<ManifestV3>

  /**
   * Final imperative hook over the fully generated manifest. Runs last (after
   * the promoted fields, the `manifest` merge, and the CRX key), so it sees
   * everything and can change anything. Mutate the argument or return a
   * replacement.
   */
  transformManifest?: (manifest: ManifestV3) => ManifestV3 | void

  /**
   * Base output directory. Default `.output`. Extro writes the unpacked
   * extension to `<outDir>/chrome-mv3-dev` and `<outDir>/chrome-mv3-prod`.
   */
  outDir?: string

  /** Dev server options for `extro dev`. */
  dev?: {
    /** Vite dev server port. Default 5173 (auto-increments unless strictPort). */
    port?: number
    /** Port for the dev bridge's HMR/reload WebSocket. Default 9012. */
    bridgePort?: number
    /** Fail if `port` is taken instead of trying the next one. */
    strictPort?: boolean
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** A Route's ancestor wrapper: a layout.tsx or an error.tsx (ADR 0003 §3). */
export type BoundaryKind = "layout" | "error"

/**
 * Shared Route skeleton. `TLeaf` is the per-side payload (build carries file
 * paths, runtime carries lazy imports). `TPattern` is the per-side shape of a
 * dynamic Route's matcher: a source string in the serializable Route
 * manifest, a live RegExp at runtime. `paramKeys` is byte-identical on every
 * side, so it stays in the skeleton.
 *
 * See ADR 0005: the Route manifest is the single typed source; the runtime
 * Route type is derived from this same skeleton, never re-declared.
 */
export type StaticRouteShape<TLeaf> = {
  type: "static"
  /** URL path, e.g. "/" or "/settings". */
  path: string
} & TLeaf

export type DynamicRouteShape<TLeaf, TPattern> = {
  type: "dynamic"
  /** Human-readable pattern, e.g. "/user/:id". */
  path: string
  /** Ordered param names matching the matcher's capture groups. */
  paramKeys: string[]
} & TPattern &
  TLeaf

export type RouteShape<TLeaf, TPattern> =
  | StaticRouteShape<TLeaf>
  | DynamicRouteShape<TLeaf, TPattern>

// --- Route manifest: the serializable build->runtime contract (ADR 0005) ---

/** One ancestor wrapper in a Route's boundary chain, build side. */
export type ManifestBoundary = { kind: BoundaryKind; file: string }

type ManifestLeaf = { file: string; boundaries: ManifestBoundary[] }
type ManifestPattern = { patternSource: string }

export type ManifestRoute = RouteShape<ManifestLeaf, ManifestPattern>

/**
 * The serializable, per-Routable-surface routing contract. Produced by the
 * scanner, consumed by the single codegen (`emit`) that materializes the
 * `virtual:extro/routes/<surface>` Runtime module. Strings only: it
 * stable-stringifies for HMR invalidation and is plain test-fixture data.
 */
export type RouteManifest = {
  routes: ManifestRoute[]
  /** Surface-root not-found.tsx, or null. */
  notFound: string | null
  /** Surface-root layout.tsx, or null. */
  rootLayout: string | null
}

// --- Runtime contract: derived from the same skeleton, React-agnostic ------

/** One loaded ancestor wrapper at runtime. `TMod` is the module shape. */
export type RuntimeBoundary<TMod> = {
  kind: BoundaryKind
  load: () => Promise<TMod>
}

/**
 * The runtime Route type, derived from the same `RouteShape` skeleton as the
 * manifest. Generic over the page/boundary module types so `@extrojs/types`
 * needs no React dependency; `@extrojs/react` instantiates them.
 */
export type RuntimeRoute<TPageMod, TBoundaryMod> = RouteShape<
  { load: () => Promise<TPageMod>; boundaries: RuntimeBoundary<TBoundaryMod>[] },
  { pattern: RegExp }
>
