import type { AnchorHTMLAttributes, MouseEvent } from "react"

import { createElement } from "react"
import { useRouter } from "./hooks.js"

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Route to navigate to, e.g. "/settings". The leading "#" is added for you. */
  href: string
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean
}

/**
 * @describe Hash-router-aware anchor. Renders a real `<a>` pointing at the hash
 * route, so middle-click and open-in-new-tab keep working, and prepends the "#"
 * for you. With `replace`, it intercepts a plain left-click and swaps the
 * current entry via `router.replace` instead of pushing a new one.
 * @example <Link href="/settings">Settings</Link>
 */
export const Link = ({ href, replace = false, onClick, ...rest }: LinkProps) => {
  const router = useRouter()
  const to = href.startsWith("#") ? href.slice(1) : href

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)

    // Leave modified clicks (new tab/window) and handlers that already
    // prevented default to the browser; only take over a plain left-click.
    if (!replace || event.defaultPrevented) return
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    router.replace(to)
  }

  return createElement("a", { href: `#${to}`, onClick: handleClick, ...rest })
}
