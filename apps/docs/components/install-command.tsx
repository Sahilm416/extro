"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

interface InstallCommandProps {
  command: string
}

export function InstallCommand({ command }: InstallCommandProps) {
  const [copied, setCopied] = useState<boolean>(false)

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy install command"
      className="group inline-flex h-10 items-center gap-3 rounded-md border border-fd-border bg-fd-card px-4 font-mono text-sm transition-colors hover:border-[#CC785C]/40"
    >
      <span className="select-none text-[#CC785C]">$</span>
      <span>{command}</span>
      {copied ? (
        <Check className="size-3.5 text-[#CC785C]" />
      ) : (
        <Copy className="size-3.5 text-fd-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  )
}
