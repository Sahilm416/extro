import type { ErrorProps } from "./types.js"

import { createElement } from "react"

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
