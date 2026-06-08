import type { Router, RouterContextValue } from "./context.js"

import { useContext, useMemo } from "react"
import { RouterContext } from "./context.js"

const useRouterContext = (): RouterContextValue => {
  const ctx = useContext(RouterContext)
  if (!ctx) {
    throw new Error(
      "Extro: router hooks must be used inside a page rendered by createExtroRouter.",
    )
  }
  return ctx
}

export const useLocation = () => {
  const { pathname, search } = useRouterContext()
  return { pathname, search }
}

export const useParams = <
  T extends Record<string, string> = Record<string, string>,
>(): T => {
  return useRouterContext().params as T
}

export const useRouter = (): Router => useRouterContext().router

type SearchInit = URLSearchParams | string | Record<string, string>

interface UseSearchParamsResult {
  params: URLSearchParams
  setParams: (next: SearchInit) => void
}

/**
 * @describe Reads + writes the URL search string. Updates use `router.replace`
 * so query edits don't pile up history entries.
 */
export const useSearchParams = (): UseSearchParamsResult => {
  const { search, pathname, router } = useRouterContext()

  const params = useMemo<URLSearchParams>(
    () => new URLSearchParams(search),
    [search],
  )

  const setParams = (next: SearchInit) => {
    const nextSearch =
      next instanceof URLSearchParams
        ? next.toString()
        : typeof next === "string"
          ? next
          : new URLSearchParams(next).toString()

    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname)
  }

  return { params, setParams }
}
