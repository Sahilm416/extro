import { useState } from "react"

export default function Content() {
  const [count, setCount] = useState(0)

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        width: 220,
        padding: 16,
        borderRadius: 8,
        backgroundColor: "#111",
        color: "#eee",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        zIndex: 2147483647,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Extro CSUI</div>
      <p style={{ margin: "0 0 12px", opacity: 0.7 }}>
        Mounted in a shadow DOM on the host page.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setCount((n) => n - 1)}>-</button>
        <span style={{ minWidth: 24, textAlign: "center" }}>{count}</span>
        <button onClick={() => setCount((n) => n + 1)}>+</button>
        <button onClick={() => setCount(0)} style={{ marginLeft: "auto" }}>
          Reset
        </button>
      </div>
    </div>
  )
}
