import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { matchRoutes } from "./match.js"
import type { CreateRouterOptions, Route } from "./types.js"

/**
 * @describe Mounts a surface (popup | options | sidepanel) and wires hash-based
 * client-side routing into the given routes array. Called once per surface by
 * the virtual runtime module emitted by @extro/vite-plugin.
 */
export const createExtroRouter = (routes: Route[], options: CreateRouterOptions = {}) => {
  const { rootId = "root", surface } = options

  const el = document.getElementById(rootId)
  if (!el) {
    throw new Error(`Extro: #${rootId} element not found`)
  }

  const root = createRoot(el)

  // Token advances on every navigation. If a lazy load resolves after a newer
  // navigation has started, we drop the result — prevents flashing a stale page
  // when the user clicks twice quickly.
  let navToken = 0

  const render = async () => {
    const token = ++navToken
    const { pathname } = parseLocation()
    const matches = matchRoutes(pathname, routes)

    if (!matches) {
      console.error(`Extro: no route matched${surface ? ` for ${surface}` : ""}`, pathname)
      return
    }

    const leaf = matches[matches.length - 1]
    const mod = await leaf.route.load()

    if (token !== navToken) return

    const Component = mod.default
    root.render(createElement(Component, { params: leaf.params }))
  }

  window.addEventListener("hashchange", render)
  render()
}

/**
 * @describe Normalizes `window.location.hash` into a routable pathname.
 */
const parseLocation = () => {
  const [rawPath = ""] = window.location.hash.replace(/^#/, "").split("?")
  return { pathname: rawPath || "/" }
}
