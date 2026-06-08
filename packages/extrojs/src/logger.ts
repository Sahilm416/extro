import pc from "picocolors"
import { createLogger, type Logger } from "vite"

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

// Extro brand terracotta (#CC785C) on the logo's near-black (#0a0a0a).
// picocolors only does the 16 ANSI names, so emit 24-bit truecolor directly,
// gated on the same color-support check picocolors uses (auto-plain in pipes).
const brand = (s: string) =>
  pc.isColorSupported ? `\x1b[38;2;204;120;92m${s}\x1b[39m` : s

const brandTag = (s: string) =>
  pc.isColorSupported
    ? `\x1b[1m\x1b[48;2;204;120;92m\x1b[38;2;10;10;10m${s}\x1b[0m`
    : s

const tag = brandTag(" EXTRO ")

// Status prefixes stay conventional (green/yellow/red are universal terminal
// semantics); the Extro "voice" (tag, `›`, accents) carries the brand color.
export const log = {
  success: (msg: string) => console.log(`${pc.green("✓")} ${msg}`),
  info: (msg: string) => console.log(`${brand("›")} ${msg}`),
  warn: (msg: string) => console.warn(`${pc.yellow("⚠")} ${msg}`),
  error: (msg: string) => console.error(`${pc.red("✗")} ${msg}`),
  /** Low-key line for frequent, low-importance output (e.g. HMR updates).
   *  Multi-line input is prefixed per line so the `›` rail stays continuous. */
  muted: (msg: string) => {
    for (const line of msg.split("\n")) console.log(pc.dim(`›  ${line}`))
  },
}

/**
 * @describe A Vite `customLogger` that rebadges Vite's own info chatter
 * (HMR updates, page reloads, dep optimization, "building for production",
 * bundle sizes, etc.) as Extro `›` muted lines. Warnings + errors still
 * pass through Vite's logger untouched so they keep their semantics.
 */
export const createViteLogger = (): Logger => {
  const vite = createLogger()
  vite.info = (msg) => {
    const clean = msg
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replace(/^[\d:apm.\s]*\[vite\]\s*/i, "")
      .trim()
    if (!clean) return
    // Drop Vite's own startup banner — we already print "Building extension
    // for production..." / the dev banner ourselves.
    if (/^vite v[\d.]+ (building|dev server running)/i.test(clean)) return
    log.muted(clean)
  }
  return vite
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
    `  ${tag} ${pc.dim(`v${version}`)} ${brand(mode)}`,
    "",
    ...rows.map(
      (row) =>
        `  ${brand("➜")}  ${row.label.padEnd(width)}  ${brand(row.value)}`,
    ),
  ]

  if (hint) lines.push("", `  ${pc.dim(hint)}`)
  lines.push("")

  console.log(lines.join("\n"))
}
