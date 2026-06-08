import { useState } from "react"
import { asset } from "extrojs/asset"

export default function Popup() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ width: 240, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* asset() wraps chrome.runtime.getURL. logo.svg lives in public/. */}
        <img src={asset("logo.svg")} width={20} height={20} alt="Extro" />
        <strong>My Extension</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setCount((n) => n - 1)}>-</button>
        <span style={{ minWidth: 24, textAlign: "center" }}>{count}</span>
        <button onClick={() => setCount((n) => n + 1)}>+</button>
      </div>
    </div>
  )
}
