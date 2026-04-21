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
