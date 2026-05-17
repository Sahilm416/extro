import type { ComponentType, ReactNode } from "react"
import type { Router } from "./context.js"
import type {
  CreateRouterOptions,
  ErrorProps,
  LayoutProps,
  NotFoundLoader,
  RootLayoutLoader,
  Route,
  RouterSurfaceOptions,
} from "./types.js"

import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { RouterContext } from "./context.js"
import { matchRoutes } from "./match.js"
import { ErrorBoundary } from "./error-boundary.js"
import { DefaultError, DefaultNotFound } from "./defaults.js"

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err))

/**
 * @describe Mounts a surface (popup | options | sidepanel) and wires hash-based
 * client-side routing into the given routes array. Called once per surface by
 * the virtual runtime module emitted by @extrojs/vite-plugin.
 */
export interface ExtroRouterHandle {
  update: (newRoutes: Route[], opts?: RouterSurfaceOptions) => void
}

export const createExtroRouter = (routes: Route[], options: CreateRouterOptions = {}): ExtroRouterHandle => {
  const { rootId = "root" } = options

  const el = document.getElementById(rootId)
  if (!el) {
    throw new Error(`Extro: #${rootId} element not found`)
  }

  const root = createRoot(el)
  const router = createRouter()

  let currentRoutes = routes
  let notFound: NotFoundLoader = options.notFound ?? null
  let rootLayout: RootLayoutLoader = options.rootLayout ?? null
  let navToken = 0

  // Built-in fallback when the surface has no not-found.tsx (ADR 0003 §5).
  const loadNotFound = () =>
    notFound ? notFound() : Promise.resolve({ default: DefaultNotFound })

  const render = async () => {
    const token = ++navToken
    const { pathname, search } = parseLocation()
    const matches = matchRoutes(pathname, currentRoutes)

    // Wrap any inner tree in the router context plus the always-on built-in
    // error boundary (ADR 0003 §3, §5). Used by both the match and no-match
    // paths so they stay consistent.
    const provide = (params: Record<string, string>, inner: ReactNode) =>
      createElement(
        RouterContext.Provider,
        { value: { pathname, search, params, router } },
        createElement(ErrorBoundary, { fallback: DefaultError, children: inner }),
      )

    if (!matches) {
      // No Route matched: render not-found inside the surface-root layout
      // only (ADR 0003 §4). Nothing matched, so no deeper layout applies.
      let nf: { default: ComponentType }
      let rl: { default: ComponentType<LayoutProps> } | null
      try {
        ;[nf, rl] = await Promise.all([
          loadNotFound(),
          rootLayout ? rootLayout() : Promise.resolve(null),
        ])
      } catch (err) {
        if (token !== navToken) return
        root.render(
          createElement(DefaultError, {
            error: toError(err),
            reset: () => void render(),
          }),
        )
        return
      }

      if (token !== navToken) return

      let inner: ReactNode = createElement(nf.default)
      if (rl) inner = createElement(rl.default, { children: inner })
      root.render(provide({}, inner))
      return
    }

    const leaf = matches[matches.length - 1]

    // Page + ancestor boundaries load in parallel, in route order
    // (outermost first). A missing/broken module rejects here — outside
    // React render, so no boundary can catch it; surface the built-in
    // error instead of blanking the surface (ADR 0003 §5).
    let mod: Awaited<ReturnType<typeof leaf.route.load>>
    let boundaryMods: Awaited<ReturnType<Route["boundaries"][number]["load"]>>[]
    try {
      ;[mod, ...boundaryMods] = await Promise.all([
        leaf.route.load(),
        ...leaf.route.boundaries.map((b) => b.load()),
      ])
    } catch (err) {
      if (token !== navToken) return
      root.render(
        createElement(DefaultError, {
          error: toError(err),
          reset: () => void render(),
        }),
      )
      return
    }

    if (token !== navToken) return

    const Component = mod.default

    // Fold innermost-first so the outermost boundary wraps everything. Each
    // segment's error sits inside its sibling layout (the chain is ordered
    // layout-before-error per segment). Empty chain = just the page.
    const composed = leaf.route.boundaries.reduceRight<ReactNode>(
      (child, boundary, i) => {
        const Boundary = boundaryMods[i].default
        if (boundary.kind === "error") {
          return createElement(ErrorBoundary, {
            fallback: Boundary as ComponentType<ErrorProps>,
            children: child,
          })
        }
        return createElement(Boundary as ComponentType<LayoutProps>, {
          children: child,
        })
      },
      createElement(Component, { params: leaf.params }),
    )

    root.render(provide(leaf.params, composed))
  }

  window.addEventListener("hashchange", render)
  render()

  return {
    update: (newRoutes: Route[], opts?: RouterSurfaceOptions) => {
      currentRoutes = newRoutes
      if (opts) {
        notFound = opts.notFound ?? null
        rootLayout = opts.rootLayout ?? null
      }
      render()
    },
  }
}

/**
 * @describe Normalizes `window.location.hash` into a pathname + search string.
 */
const parseLocation = () => {
  const [rawPath = "", search = ""] = window.location.hash.replace(/^#/, "").split("?")
  return { pathname: rawPath || "/", search }
}

const stripHash = (to: string) => (to.startsWith("#") ? to.slice(1) : to)

/**
 * @describe Builds the stable router object passed through context. `replace`
 * uses history.replaceState + a manual hashchange dispatch because
 * replaceState alone doesn't fire the event.
 */
const createRouter = (): Router => ({
  push: (to) => {
    window.location.hash = stripHash(to)
  },
  replace: (to) => {
    window.history.replaceState(null, "", `#${stripHash(to)}`)
    window.dispatchEvent(new HashChangeEvent("hashchange"))
  },
  back: () => window.history.back(),
  forward: () => window.history.forward(),
})
