import type { Route, RouteMatch } from "./types.js"

/**
 * Walks the routes array in order and returns the match chain for the first
 * matching route, or null if nothing matched.
 *
 * Returns an array (chain) rather than a single match so the API is ready for
 * nested layouts — today the chain is always length 1, but when layouts land
 * the chain will walk from root layout → ... → leaf page.
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
