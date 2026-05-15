import type { ComponentType } from "react"
import type { RouteShape, StaticRouteShape, DynamicRouteShape } from "@extrojs/types"

export type PageProps = {
  params: Record<string, string>
}

type RouteModule = { default: ComponentType<PageProps> }

/** Runtime-side leaf: a lazy import of the page module. */
type RuntimeLeaf = { load: () => Promise<RouteModule> }

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
