import type { ComponentType, ReactElement, ReactNode } from "react"
import type { BoundaryKind } from "../types/index.js"
import type { Router } from "./context.js"
import type { ErrorProps, LayoutProps, PageProps } from "./types.js"

import { createElement } from "react"
import { RouterContext } from "./context.js"
import { ErrorBoundary } from "./error-boundary.js"
import { DefaultError } from "./defaults.js"

/** A boundary already paired with its loaded component (orchestration zips this). */
export type ResolvedBoundary = {
  kind: BoundaryKind
  component: ComponentType<LayoutProps> | ComponentType<ErrorProps>
}

/**
 * Every renderable outcome of a navigation. `buildTree` is total over this:
 * `render()` resolves one of these (with the navToken/load orchestration) and
 * hands it here; structure lives nowhere else.
 */
export type RenderOutcome =
  | {
      type: "match"
      page: ComponentType<PageProps>
      params: Record<string, string>
      boundaries: ResolvedBoundary[]
    }
  | {
      type: "not-found"
      notFound: ComponentType
      rootLayout: ComponentType<LayoutProps> | null
    }
  | { type: "load-error"; error: Error; reset: () => void }

export type RenderContext = {
  pathname: string
  search: string
  router: Router
}

/**
 * @describe The single, pure home of ADR 0003 §3/§4/§5 structure. Given a
 * resolved navigation outcome, returns the React element tree to mount:
 *
 *   - match:     <Provider><BuiltInEB> L0 <EB user> ... <Page/> ... </Provider>
 *                (each segment's error nested inside its sibling layout, §3)
 *   - not-found: <Provider><BuiltInEB> rootLayout? <NotFound/> </Provider> (§4)
 *   - load-error: bare <DefaultError/> (load failed outside React render, §5)
 *
 * Pure and total: same inputs, same tree; no DOM, no effects. The always-on
 * built-in error boundary (§5) means a match/not-found surface never blanks.
 */
export function buildTree(
  outcome: RenderOutcome,
  ctx: RenderContext,
): ReactElement {
  if (outcome.type === "load-error") {
    return createElement(DefaultError, {
      error: outcome.error,
      reset: outcome.reset,
    })
  }

  // Router context + the always-on outermost built-in error boundary (§5),
  // shared by the match and not-found paths so they stay consistent.
  const provide = (params: Record<string, string>, inner: ReactNode) =>
    createElement(
      RouterContext.Provider,
      {
        value: {
          pathname: ctx.pathname,
          search: ctx.search,
          params,
          router: ctx.router,
        },
      },
      createElement(ErrorBoundary, { fallback: DefaultError, children: inner }),
    )

  if (outcome.type === "not-found") {
    let inner: ReactNode = createElement(outcome.notFound)
    if (outcome.rootLayout) {
      inner = createElement(outcome.rootLayout, { children: inner })
    }
    return provide({}, inner)
  }

  // Fold innermost-first so the outermost boundary wraps everything; each
  // segment's error sits inside its sibling layout (the chain is ordered
  // layout-before-error per segment). Empty chain = just the page.
  const composed = outcome.boundaries.reduceRight<ReactNode>(
    (child, boundary) => {
      if (boundary.kind === "error") {
        return createElement(ErrorBoundary, {
          fallback: boundary.component as ComponentType<ErrorProps>,
          children: child,
        })
      }
      return createElement(boundary.component as ComponentType<LayoutProps>, {
        children: child,
      })
    },
    createElement(outcome.page, { params: outcome.params }),
  )

  return provide(outcome.params, composed)
}
