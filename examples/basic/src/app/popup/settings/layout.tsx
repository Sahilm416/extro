import type { LayoutProps } from "@extrojs/react/router"

export default function SettingsLayout({ children }: LayoutProps) {
  return (
    <section
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#888" }}>
        Settings (nested layout)
      </p>
      {children}
    </section>
  )
}
