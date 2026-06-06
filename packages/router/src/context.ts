import { createContext } from "react"

export interface Router {
  push: (to: string) => void
  replace: (to: string) => void
  back: () => void
  forward: () => void
}

export interface RouterContextValue {
  pathname: string
  search: string
  params: Record<string, string>
  router: Router
}

export const RouterContext = createContext<RouterContextValue | null>(null)
