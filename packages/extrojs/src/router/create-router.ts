import type { ComponentType } from "react"
import type { Router } from "./context.js"
import type {
  CreateRouterOptions,
  LayoutProps,
  NotFoundLoader,
  RootLayoutLoader,
  Route,
  RouterSurfaceOptions,
} from "./types.js"

import { createRoot } from "react-dom/client"
import { matchRoutes } from "./match.js"
import { DefaultNotFound } from "./defaults.js"
import { buildTree } from "./build-tree.js"

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

  // Pure orchestration: resolve the navigation outcome (with the navToken
  // guard + load failure handling) and hand it to `buildTree`. No structure
  // lives here — every renderable shape is in build-tree.ts (ADR 0006).
  const render = async () => {
    const token = ++navToken
    const { pathname, search } = parseLocation()
    const ctx = { pathname, search, router }
    const matches = matchRoutes(pathname, currentRoutes)

    if (!matches) {
      // No Route matched: not-found inside the surface-root layout only
      // (ADR 0003 §4). Nothing matched, so no deeper layout is in scope.
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
          buildTree(
            { type: "load-error", error: toError(err), reset: () => void render() },
            ctx,
          ),
        )
        return
      }

      if (token !== navToken) return

      root.render(
        buildTree(
          {
            type: "not-found",
            notFound: nf.default,
            rootLayout: rl ? rl.default : null,
          },
          ctx,
        ),
      )
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
        buildTree(
          { type: "load-error", error: toError(err), reset: () => void render() },
          ctx,
        ),
      )
      return
    }

    if (token !== navToken) return

    // Zip each boundary's kind with its loaded component; structure (the
    // §3 nesting) is buildTree's job, not this orchestrator's.
    const boundaries = leaf.route.boundaries.map((b, i) => ({
      kind: b.kind,
      component: boundaryMods[i].default,
    }))

    root.render(
      buildTree(
        {
          type: "match",
          page: mod.default,
          params: leaf.params,
          boundaries,
        },
        ctx,
      ),
    )
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
