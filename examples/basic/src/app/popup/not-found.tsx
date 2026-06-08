import { useLocation, useRouter } from "extrojs/navigation"

export default function PopupNotFound() {
  const { pathname } = useLocation()
  const router = useRouter()

  return (
    <div>
      <p style={{ margin: "0 0 12px" }}>
        Nothing here: <code>{pathname}</code>
      </p>
      <button onClick={() => router.push("/")}>Go home</button>
    </div>
  )
}
