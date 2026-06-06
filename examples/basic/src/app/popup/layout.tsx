import type { LayoutProps } from "@extrojs/router"

import { Link } from "@extrojs/router"

export default function PopupLayout({ children }: LayoutProps) {
  return (
    <div style={{ width: 260, fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <strong style={{ fontSize: 14 }}>Extro</strong>
        <nav
          style={{
            display: "flex",
            gap: 12,
            marginLeft: "auto",
            fontSize: 13,
          }}
        >
          <Link href="/">Home</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </header>

      <main style={{ padding: 16 }}>{children}</main>
    </div>
  )
}
