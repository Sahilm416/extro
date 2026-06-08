import fs from "node:fs"
import path from "node:path"

/** True when the path does not exist, or exists with nothing but a `.git` dir. */
export const isDirEmpty = (dir: string): boolean => {
  if (!fs.existsSync(dir)) return true
  const entries = fs.readdirSync(dir)
  return entries.length === 0 || (entries.length === 1 && entries[0] === ".git")
}

/** Remove every child of `dir` except `.git`, leaving the directory itself. */
export const emptyDir = (dir: string): void => {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir)) {
    if (entry === ".git") continue
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
  }
}

/**
 * @describe Coerce a directory basename into a valid npm package name: lower
 * case, spaces to hyphens, strip leading dots/underscores, and replace any
 * remaining illegal characters. Mirrors the normalization create-vite applies.
 */
export const toValidPackageName = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^[._]+/, "")
    .replace(/[^a-z0-9-~]+/g, "-")
    .replace(/^-+|-+$/g, "") || "extro-extension"

/** Display form of the target: the cwd-relative path, or "." for the cwd itself. */
export const relativeTarget = (cwd: string, targetDir: string): string =>
  path.relative(cwd, targetDir) || "."
