import type { ComponentType, ReactNode } from "react"
import type { Router } from "./context.js"
import type {
  CreateRouterOptions,
  ErrorProps,
  LayoutProps,
  Route,
} from "./types.js"

import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { RouterContext } from "./context.js"
import { matchRoutes } from "./match.js"
import { ErrorBoundary } from "./error-boundary.js"
import { DefaultError } from "./defaults.js"

/**
 * @describe Mounts a surface (popup | options | sidepanel) and wires hash-based
 * client-side routing into the given routes array. Called once per surface by
 * the virtual runtime module emitted by @extrojs/vite-plugin.
 */
export interface ExtroRouterHandle {
  update: (newRoutes: Route[]) => void
}

export const createExtroRouter = (routes: Route[], options: CreateRouterOptions = {}): ExtroRouterHandle => {
  const { rootId = "root", surface } = options

  const el = document.getElementById(rootId)
  if (!el) {
    throw new Error(`Extro: #${rootId} element not found`)
  }

  const root = createRoot(el)
  const router = createRouter()

  let currentRoutes = routes
  let navToken = 0

  const render = async () => {
    const token = ++navToken
    const { pathname, search } = parseLocation()
    const matches = matchRoutes(pathname, currentRoutes)

    if (!matches) {
      console.error(`Extro: no route matched${surface ? ` for ${surface}` : ""}`, pathname)
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
          error: err instanceof Error ? err : new Error(String(err)),
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

    // Always-on outermost boundary: catches anything the user chain misses,
    // including a thrown surface-root layout (ADR 0003 §3, §5).
    const tree = createElement(ErrorBoundary, {
      fallback: DefaultError,
      children: composed,
    })

    root.render(
      createElement(
        RouterContext.Provider,
        { value: { pathname, search, params: leaf.params, router } },
        tree,
      ),
    )
  }

  window.addEventListener("hashchange", render)
  render()

  return {
    update: (newRoutes: Route[]) => {
      currentRoutes = newRoutes
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
