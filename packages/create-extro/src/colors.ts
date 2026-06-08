import pc from "picocolors"

// Extro brand terracotta (#CC785C / rgb 204,120,92) on the logo's near-black
// (#0a0a0a). This mirrors the framework CLI (packages/extrojs logger) so
// `create-extro` and `extro dev` read as one coherent voice. picocolors only
// covers the 16 ANSI names, so emit 24-bit truecolor directly, gated on the
// same color-support check picocolors uses (auto-plain in pipes and CI).
export const brand = (s: string): string =>
  pc.isColorSupported ? `\x1b[38;2;204;120;92m${s}\x1b[39m` : s

export const brandTag = (s: string): string =>
  pc.isColorSupported
    ? `\x1b[1m\x1b[48;2;204;120;92m\x1b[38;2;10;10;10m${s}\x1b[0m`
    : s

export const dim = pc.dim
export const bold = pc.bold
export const green = pc.green
