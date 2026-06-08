import type { ErrorProps } from "extrojs/navigation"

export default function PopupError({ error, reset }: ErrorProps) {
  return (
    <div>
      <p style={{ color: "#b00", margin: "0 0 12px" }}>Caught: {error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
