import pc from "picocolors"

interface BannerRow {
  label: string
  value: string
}

interface BannerOptions {
  mode: string
  version: string
  rows: BannerRow[]
  hint?: string
}

const tag = pc.bold(pc.bgCyan(pc.black(" EXTRO ")))

// Consistent prefixes so framework output reads distinctly from Vite's logs.
export const log = {
  success: (msg: string) => console.log(`${pc.green("✓")} ${msg}`),
  info: (msg: string) => console.log(`${pc.cyan("›")} ${msg}`),
  warn: (msg: string) => console.warn(`${pc.yellow("⚠")} ${msg}`),
  error: (msg: string) => console.error(`${pc.red("✗")} ${msg}`),
}

/**
 * @describe Prints the grouped startup banner: a brand tag with version/mode,
 * then aligned label/value rows and an optional dimmed hint. Mirrors Vite's
 * own startup idiom so the two read as a coherent stack.
 */
export const banner = ({ mode, version, rows, hint }: BannerOptions) => {
  const width = Math.max(...rows.map((row) => row.label.length))

  const lines = [
    "",
    `  ${tag} ${pc.dim(`v${version}`)} ${pc.cyan(mode)}`,
    "",
    ...rows.map(
      (row) =>
        `  ${pc.green("➜")}  ${row.label.padEnd(width)}  ${pc.cyan(row.value)}`,
    ),
  ]

  if (hint) lines.push("", `  ${pc.dim(hint)}`)
  lines.push("")

  console.log(lines.join("\n"))
}
