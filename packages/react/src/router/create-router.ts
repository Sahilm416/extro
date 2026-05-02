import type { Router } from "./context.js"
import type { CreateRouterOptions, Route } from "./types.js"

import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { RouterContext } from "./context.js"
import { matchRoutes } from "./match.js"

/**
 * @describe Mounts a surface (popup | options | sidepanel) and wires hash-based
 * client-side routing into the given routes array. Called once per surface by
 * the virtual runtime module emitted by @extro/vite-plugin.
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
    const mod = await leaf.route.load()

    if (token !== navToken) return

    const Component = mod.default
    root.render(
      createElement(
        RouterContext.Provider,
        { value: { pathname, search, params: leaf.params, router } },
        createElement(Component, { params: leaf.params }),
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
