import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { FeatureCard } from "@/components/feature-card"

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.13 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  )
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
            href="/docs"
            className="group inline-flex h-10 items-center gap-1.5 rounded-md bg-[#CC785C] px-4 text-sm font-medium text-white hover:bg-[#b8674e]"
          >
            Get started
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="https://github.com/Sahilm416/extro"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-fd-border px-4 text-sm font-medium hover:bg-fd-muted"
          >
            <GithubIcon className="size-4" />
            GitHub
          </Link>
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
      body: "Hash-based router for popup, options, and sidepanel. Dynamic [id] segments, search params, and the hooks you'd expect, all type-safe.",
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

