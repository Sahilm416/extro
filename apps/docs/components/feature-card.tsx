"use client"

import { useRef } from "react"

interface FeatureCardProps {
  title: string
  body: string
}

export function FeatureCard({ title, body }: FeatureCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`)
    el.style.setProperty("--my", `${e.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className="group relative overflow-hidden rounded-xl border border-fd-border bg-fd-background/60 p-6 backdrop-blur-md transition-colors hover:border-[#CC785C]/40"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(450px circle at var(--mx) var(--my), rgba(204,120,92,0.18), transparent 40%)",
        }}
      />
      <div className="relative">
        <h3 className="text-base font-semibold!">{title}</h3>
        <p className="mt-2 text-sm text-fd-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
