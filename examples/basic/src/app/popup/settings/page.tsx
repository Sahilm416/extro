import { useLocation, useRouter, useSearchParams } from "@extrojs/react/router"

export default function Settings() {
  const router = useRouter()
  const { pathname } = useLocation()
  const { params, setParams } = useSearchParams()

  const tab = params.get("tab") ?? "general"

  return (
    <div>
      <h1>Settings page</h1>
      <p>Path: {pathname}</p>
      <p>Tab: {tab}</p>

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => setParams({ tab: "general" })}>General</button>
        <button onClick={() => setParams({ tab: "privacy" })}>Privacy</button>
        <button onClick={() => setParams({ tab: "advanced" })}>Advanced</button>
      </div>

      <button onClick={() => router.push("/")}>Home</button>
    </div>
  )
}
