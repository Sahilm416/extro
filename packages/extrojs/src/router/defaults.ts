import type { ErrorProps } from "./types.js"

import { createElement } from "react"
import { useLocation } from "./hooks.js"

/**
 * @describe Built-in error fallback (ADR 0003 §5). Always the outermost
 * boundary so a thrown render never blanks the surface. Deliberately
 * unstyled and minimal; shows `error.message` always (the extension error
 * surface is seen by the developer far more than end users in v0.x).
 */
export const DefaultError = ({ error, reset }: ErrorProps) =>
  createElement(
    "div",
    { style: { padding: 16, fontFamily: "system-ui, sans-serif" } },
    createElement("p", { style: { margin: "0 0 8px", fontWeight: 600 } }, "Something went wrong"),
    createElement(
      "pre",
      {
        style: {
          margin: "0 0 12px",
          whiteSpace: "pre-wrap",
          fontSize: 12,
          color: "#b00",
        },
      },
      error.message,
    ),
    createElement("button", { onClick: reset }, "Try again"),
  )

/**
 * @describe Built-in not-found fallback (ADR 0003 §4/§5). Rendered when a
 * hash matches no Route. Takes no props per the user contract; reads the
 * unmatched path from the router context it is mounted within.
 */
export const DefaultNotFound = () => {
  const { pathname } = useLocation()
  return createElement(
    "div",
    { style: { padding: 16, fontFamily: "system-ui, sans-serif" } },
    createElement("p", { style: { margin: "0 0 4px", fontWeight: 600 } }, "404"),
    createElement(
      "p",
      { style: { margin: 0, fontSize: 13, color: "#666" } },
      `No route for ${pathname}`,
    ),
  )
}
