import { useParams, useRouter } from "@extro/react/router"

export default function Page() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  return (
    <div>
      <h1>User</h1>
      <h2>ID: {id}</h2>
      <button onClick={() => router.back()}>Back</button>
      <button onClick={() => router.push("/")}>Home</button>
    </div>
  )
}
