export interface ManifestV3 {
  manifest_version: 3
  name?: string
  description?: string
  version: string
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
}

export interface ExtroConfig {
  name?: string
  version?: string
  description?: string
  permissions?: string[]
  hostPermissions?: string[]
  icons?: Record<string, string>
  manifest?: Partial<ManifestV3>
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Shared route shape between build-time (where the leaf carries the source
 * file path) and runtime (where the leaf carries a lazy import function).
 * Parameterized by `TLeaf` — the per-side payload appended to each route.
 *
 *   build-side:   RouteShape<{ file: string }>
 *   runtime-side: RouteShape<{ load: () => Promise<RouteModule> }>
 */
export type StaticRouteShape<TLeaf> = {
  type: "static"
  /** URL path, e.g. "/" or "/settings". */
  path: string
} & TLeaf

export type DynamicRouteShape<TLeaf> = {
  type: "dynamic"
  /** Human-readable pattern, e.g. "/user/:id". */
  path: string
  /** Ordered param names matching the regex capture groups. */
  paramKeys: string[]
  /** Pre-compiled RegExp; capture groups correspond positionally to paramKeys. */
  pattern: RegExp
} & TLeaf

export type RouteShape<TLeaf> =
  | StaticRouteShape<TLeaf>
  | DynamicRouteShape<TLeaf>
