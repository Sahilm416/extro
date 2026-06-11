import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { FeatureCard } from "@/components/feature-card"
import { InstallCommand } from "@/components/install-command"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <Hero />
      <Convention />
      <Features />
    </main>
  )
}

function Hero() {
  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <p className="mb-4 font-mono text-xs uppercase tracking-wider text-[#CC785C]">
          Extro
        </p>
        <h1 className="text-4xl font-semibold! tracking-tight sm:text-5xl">
          Next.js for Chrome extensions.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-fd-muted-foreground">
          File-based entrypoints, automatic Manifest V3, and type-safe
          routing, driven by a single Vite plugin. ESM-only, React, MV3.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/docs/guide"
            className="group inline-flex h-10 items-center gap-1.5 rounded-md bg-[#CC785C] px-4 text-sm font-medium text-white hover:bg-[#b8674e]"
          >
            Get started
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <InstallCommand command="pnpm create extro" />
        </div>
      </div>
    </section>
  )
}

function Convention() {
  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-20 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold! tracking-tight sm:text-3xl">
            Drop a file, get a surface.
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Every entrypoint is a file under{" "}
            <code className="rounded bg-fd-muted px-1.5 py-0.5 font-mono text-sm">
              src/app/
            </code>
            . Extro scans the tree, generates the manifest, and wires up
            routing so the dev loop feels like a normal React app.
          </p>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-fd-border bg-fd-card p-5 font-mono text-sm leading-6">
{`src/app/
├── popup/
│   ├── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   └── c/[id]/
│       └── page.tsx
├── options/
│   └── page.tsx
├── sidepanel/
│   └── page.tsx
├── content/
│   └── page.tsx        `}<span className="text-[#CC785C]">← CSUI</span>{`
└── background/
    └── index.ts`}
        </pre>
      </div>
    </section>
  )
}

function Features() {
  const items = [
    {
      title: "File-based routing",
      body: "Hash-based router for popup, options, and sidepanel. A Link component, dynamic [id] segments, search params, and the hooks you'd expect, all type-safe.",
    },
    {
      title: "Manifest V3, generated",
      body: "Surfaces, permissions, host matches, CSP, icons. Inferred from your tree and config, with a full escape hatch when you need it.",
    },
    {
      title: "Real HMR",
      body: "Popup, options, and sidepanel get full React Fast Refresh with state preservation. Content scripts soft-remount without reloading the host page.",
    },
    {
      title: "One Vite plugin",
      body: "No custom bundler, no per-surface build configs. Vite handles the dev server; the extro plugin handles entries, virtual modules, and assets.",
    },
  ]
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(800px circle at 50% 0%, rgba(204,120,92,0.08), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <FeatureCard
              key={item.title}
              title={item.title}
              body={item.body}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

