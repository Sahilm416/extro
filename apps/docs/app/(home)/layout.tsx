import Link from "next/link"
import { appName, gitConfig } from "@/lib/shared"
import { ExtroIcon } from "@/components/extro-icon"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}

function Navbar() {
  return (
    <header className="border-b border-fd-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <ExtroIcon size={22} />
          <span className="font-mono text-sm font-semibold tracking-tight">
            {appName.toLowerCase()}
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/docs"
            className="text-fd-muted-foreground hover:text-fd-foreground"
          >
            Docs
          </Link>
          <Link
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            className="text-fd-muted-foreground hover:text-fd-foreground"
          >
            GitHub
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-fd-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6 text-xs text-fd-muted-foreground">
        <span className="font-mono">{appName.toLowerCase()}</span>
        <span>MIT licensed</span>
      </div>
    </footer>
  )
}
