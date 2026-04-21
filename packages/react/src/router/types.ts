import type { ComponentType } from "react"

export type PageProps = {
  params: Record<string, string>
}

type RouteModule = { default: ComponentType<PageProps> }

export type StaticRoute = {
  type: "static"
  path: string
  load: () => Promise<RouteModule>
}

export type DynamicRoute = {
  type: "dynamic"
  path: string
  paramKeys: string[]
  pattern: RegExp
  load: () => Promise<RouteModule>
}

export type Route = StaticRoute | DynamicRoute

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
