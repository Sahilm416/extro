import { Link } from "@extrojs/router"

export default function Options() {
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 12px" }}>Options</h1>
      <nav>
        <Link href="/about">About</Link>
      </nav>
    </div>
  )
}
