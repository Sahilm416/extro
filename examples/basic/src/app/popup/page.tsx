import { useState } from "react"

export default function Popup() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ width: 240, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 12px" }}>Extro popup</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setCount((n) => n - 1)}>-</button>
        <span style={{ minWidth: 24, textAlign: "center" }}>{count}</span>
        <button onClick={() => setCount((n) => n + 1)}>+</button>
        <button onClick={() => setCount(0)} style={{ marginLeft: "auto" }}>
          Reset
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <a href="#/settings">Settings</a>
        <a href="#/c/123">User 123</a>
        <a href="#/c/456">User 456</a>
      </div>
    </div>
  )
}
