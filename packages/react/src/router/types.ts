import type { ComponentType, ReactNode } from "react"
import type { RouteShape, StaticRouteShape, DynamicRouteShape } from "@extrojs/types"

export type PageProps = {
  params: Record<string, string>
}

export type LayoutProps = {
  children: ReactNode
}

type RouteModule = { default: ComponentType<PageProps> }
type LayoutModule = { default: ComponentType<LayoutProps> }

/** A lazy import of one ancestor layout module. */
export type LayoutLoader = () => Promise<LayoutModule>

/**
 * Runtime-side leaf: a lazy import of the page module plus its ancestor
 * layout chain (outermost first), resolved at build time by the plugin.
 */
type RuntimeLeaf = {
  load: () => Promise<RouteModule>
  layouts: LayoutLoader[]
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
