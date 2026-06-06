import { useState } from "react"

function Boom(): never {
  throw new Error("Popup page crashed on purpose")
}

export default function Popup() {
  const [count, setCount] = useState(0)
  const [boom, setBoom] = useState(false)

  if (boom) return <Boom />

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {/* A Public asset from public/logo.svg, referenced via the portable
            chrome.runtime.getURL so the same code works on any surface. */}
        <img src={chrome.runtime.getURL("logo.svg")} width={20} height={20} alt="Extro" />
        {/* A Public env var, inlined at build time from .env. Falls back so a
            fresh clone renders without a local .env. */}
        <strong>{import.meta.env.EXTRO_PUBLIC_GREETING ?? "Extro"}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setCount((n) => n - 1)}>-</button>
        <span style={{ minWidth: 24, textAlign: "center" }}>{count}</span>
        <button onClick={() => setCount((n) => n + 1)}>+</button>
        <button onClick={() => setCount(0)} style={{ marginLeft: "auto" }}>
          Reset
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <a href="#/c/123">User 123</a>
        <a href="#/c/456">User 456</a>
        <a href="#/nope">Broken link</a>
        <button onClick={() => setBoom(true)}>Break this page</button>
      </div>
    </div>
  )
}
