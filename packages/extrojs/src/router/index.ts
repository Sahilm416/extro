// Pulls in the ambient env typing so importing a routing subpath is enough to
// type `import.meta.env` with no extra setup.
import "../react/env.js"

export { createExtroRouter } from "./create-router.js"
export type { ExtroRouterHandle } from "./create-router.js"
export { matchRoutes } from "./match.js"
export { Link } from "./link.js"
export {
  useLocation,
  useParams,
  useRouter,
  useSearchParams,
} from "./hooks.js"
export type { Router, RouterContextValue } from "./context.js"
export type {
  CreateRouterOptions,
  DynamicRoute,
  ErrorProps,
  LayoutProps,
  PageProps,
  Route,
  RouteMatch,
  StaticRoute,
} from "./types.js"
