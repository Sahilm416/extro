import type { ComponentType, ReactNode } from "react"
import type {
  BoundaryKind,
  RuntimeBoundary,
  RuntimeRoute,
} from "@extrojs/types"

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

export type { BoundaryKind }

/**
 * The runtime Route type is *derived* from `@extrojs/types`' single source
 * (ADR 0005), not re-declared: the same skeleton as the Route manifest, with
 * the React module types substituted in and `pattern` materialized to a real
 * RegExp. A round-trip test asserts the codegen output satisfies this.
 */
export type Boundary = RuntimeBoundary<BoundaryModule>
export type Route = RuntimeRoute<RouteModule, BoundaryModule>
export type StaticRoute = Extract<Route, { type: "static" }>
export type DynamicRoute = Extract<Route, { type: "dynamic" }>

export type RouteMatch = {
  route: Route
  params: Record<string, string>
}

/** Surface-root not-found.tsx (no props, ADR 0003 §5). `null` when absent. */
export type NotFoundLoader =
  | (() => Promise<{ default: ComponentType }>)
  | null

/** Surface-root layout.tsx, wraps not-found. `null` when absent. */
export type RootLayoutLoader =
  | (() => Promise<{ default: ComponentType<LayoutProps> }>)
  | null

export type RouterSurfaceOptions = {
  notFound?: NotFoundLoader
  rootLayout?: RootLayoutLoader
}

export type CreateRouterOptions = RouterSurfaceOptions & {
  /** DOM id to mount into. Defaults to "root". */
  rootId?: string
  /** Human-readable surface name (popup | options | sidepanel). Used in error logs. */
  surface?: string
}
