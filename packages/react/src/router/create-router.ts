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

  const getCurrentPath = () => window.location.hash.replace(/^#/, "") || "/"

  const render = async () => {
    const path = getCurrentPath()
    const matches = matchRoutes(path, routes)

    if (!matches) {
      console.error(`Extro: no route matched${surface ? ` for ${surface}` : ""}`, path)
      return
    }

    const leaf = matches[matches.length - 1]
    const mod = await leaf.route.load()
    const Component = mod.default

    root.render(createElement(Component, { params: leaf.params }))
  }

  window.addEventListener("hashchange", render)
  render()
}
