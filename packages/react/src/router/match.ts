import type { Route, RouteMatch } from "./types.js"

/**
 * Walks the routes array in order and returns the match chain for the first
 * matching route, or null if nothing matched.
 *
 * Returns a single-element array. The boundary chain (layouts + errors) is
 * resolved at build time and rides on the matched route's leaf
 * (`route.boundaries`), so the match never needs to grow into a multi-segment
 * walk (see ADR 0003).
 *
 * The input array is expected to be pre-sorted so static routes come before
 * dynamic ones (enforced at build time by the vite plugin).
 */
export const matchRoutes = (path: string, routes: Route[]): RouteMatch[] | null => {
  for (const route of routes) {
    if (route.type === "static") {
      if (route.path === path) return [{ route, params: {} }]
      continue
    }

    const match = path.match(route.pattern)
    if (!match) continue

    const params = Object.fromEntries(
      route.paramKeys.map((key, i) => [key, match[i + 1]]),
    )

    return [{ route, params }]
  }

  return null
}
