export default function About() {
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>About</h1>
      <p style={{ margin: "0 0 12px" }}>
        Sub-route under <code>/app/options/</code> — proves nested routing works.
      </p>
      <a href="#/">Back</a>
    </div>
  )
}
