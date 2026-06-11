import { useState } from "react"
import { asset } from "extrojs/asset"

export default function Popup() {
  const [count, setCount] = useState<number>(0)

  return (
    <>
      <style>{styles}</style>
      <main className="popup">
        <header className="brand">
          {/* asset() wraps chrome.runtime.getURL. logo.svg lives in public/. */}
          <img src={asset("logo.svg")} width={56} height={56} alt="Extro" />
          <span className="brand-x">×</span>
          <ReactLogo />
        </header>

        <h1>extro × react</h1>
        <p className="tagline">Next.js for Chrome extensions.</p>

        <section className="counter">
          <button
            className="ghost"
            aria-label="Decrement"
            onClick={() => setCount((n) => n - 1)}
          >
            −
          </button>
          <span className="count">{count}</span>
          <button
            className="solid"
            aria-label="Increment"
            onClick={() => setCount((n) => n + 1)}
          >
            +
          </button>
        </section>

        <p className="hint">
          Edit <code>src/app/popup/page.tsx</code> to get started.
        </p>
      </main>
    </>
  )
}

const ReactLogo = () => (
  <svg viewBox="-11.5 -10.23 23 20.46" width={56} height={56} aria-label="React">
    <circle r="2.05" fill="#58C4DC" />
    <g stroke="#58C4DC" fill="none">
      <ellipse rx="11" ry="4.2" />
      <ellipse rx="11" ry="4.2" transform="rotate(60)" />
      <ellipse rx="11" ry="4.2" transform="rotate(120)" />
    </g>
  </svg>
)

const styles = `
  :root { color-scheme: dark; }
  body {
    margin: 0;
    background: #0a0a0a;
    color: #fafafa;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  .popup {
    box-sizing: border-box;
    width: 360px;
    min-height: 420px;
    padding: 40px 28px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: radial-gradient(
      320px circle at 50% 0%,
      rgba(204, 120, 92, 0.14),
      transparent 60%
    );
  }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand-x { font-size: 20px; color: #525252; }
  h1 {
    margin: 22px 0 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 21px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .tagline { margin: 6px 0 0; font-size: 13px; color: #a3a3a3; }
  .counter {
    margin-top: 28px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    background: #141414;
    border: 1px solid #262626;
    border-radius: 10px;
  }
  .count {
    min-width: 48px;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 22px;
    font-variant-numeric: tabular-nums;
  }
  button {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s;
  }
  .solid { border: none; background: #CC785C; color: #fff; }
  .solid:hover { background: #b8674e; }
  .ghost { border: 1px solid #2e2e2e; background: transparent; color: #fafafa; }
  .ghost:hover { background: #1a1a1a; }
  .hint { margin: auto 0 0; padding-top: 28px; font-size: 12px; color: #737373; }
  .hint code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    padding: 2px 6px;
    color: #CC785C;
    background: #1a1a1a;
    border-radius: 4px;
  }
`
