import type { Router } from "../context.js"

import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Link } from "../link.js"
import { RouterContext } from "../context.js"

// Link reads RouterContext (via useRouter), but the render path never touches a
// router method, so a stub is enough. No DOM: we assert the server-rendered
// markup, which is exactly the anchor the browser would see.
const router = {} as Router
const ctx = { pathname: "/", search: "", params: {}, router }

const render = (props: Parameters<typeof Link>[0], children?: string) =>
  renderToStaticMarkup(
    createElement(
      RouterContext.Provider,
      { value: ctx },
      createElement(Link, props, children),
    ),
  )

describe("Link", () => {
  it("renders a real <a> and prepends '#' to the route", () => {
    expect(render({ href: "/settings" }, "Settings")).toBe(
      '<a href="#/settings">Settings</a>',
    )
  })

  it("does not double the '#' when the href already has one", () => {
    expect(render({ href: "#/settings" })).toBe('<a href="#/settings"></a>')
  })

  it("forwards standard anchor props", () => {
    const html = render(
      { href: "/", className: "nav-link", title: "Home" },
      "Home",
    )
    expect(html).toContain('href="#/"')
    expect(html).toContain('class="nav-link"')
    expect(html).toContain('title="Home"')
  })
})
