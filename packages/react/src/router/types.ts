import type { ComponentType, ReactNode } from "react"
import type { RouteShape, StaticRouteShape, DynamicRouteShape } from "@extrojs/types"

export type PageProps = {
  params: Record<string, string>
}

export type LayoutProps = {
  children: ReactNode
}

export type ErrorProps = {
  error: Error
  reset: () => void
}

type RouteModule = { default: ComponentType<PageProps> }
type BoundaryModule = {
  default: ComponentType<LayoutProps> | ComponentType<ErrorProps>
}

export type BoundaryKind = "layout" | "error"

/** One ancestor wrapper for a route: a lazy import of a layout or error module. */
export type Boundary = {
  kind: BoundaryKind
  load: () => Promise<BoundaryModule>
}

/**
 * Runtime-side leaf: a lazy import of the page module plus its ancestor
 * boundary chain (outermost first, layout-before-error within a segment),
 * resolved at build time by the plugin.
 */
type RuntimeLeaf = {
  load: () => Promise<RouteModule>
  boundaries: Boundary[]
}

export type StaticRoute = StaticRouteShape<RuntimeLeaf>
export type DynamicRoute = DynamicRouteShape<RuntimeLeaf>
export type Route = RouteShape<RuntimeLeaf>

export type RouteMatch = {
  route: Route
  params: Record<string, string>
}

export type CreateRouterOptions = {
  /** DOM id to mount into. Defaults to "root". */
  rootId?: string
  /** Human-readable surface name (popup | options | sidepanel). Used in error logs. */
  surface?: string
}
