import spawn from "cross-spawn"
import type { PkgManager } from "./pkg-manager.js"
import { installArgs } from "./pkg-manager.js"

/** Install dependencies in `cwd` with the given manager. Returns success. */
export const installDependencies = (pm: PkgManager, cwd: string): boolean => {
  const result = spawn.sync(pm, installArgs(pm), { cwd, stdio: "ignore" })
  return result.status === 0
}

/** Whether a `git` binary is on PATH. */
export const isGitInstalled = (): boolean =>
  spawn.sync("git", ["--version"], { stdio: "ignore" }).status === 0

/** Whether `dir` already sits inside a git work tree (so we should not re-init). */
export const isInsideGitRepo = (dir: string): boolean =>
  spawn.sync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: dir,
    stdio: "ignore",
  }).status === 0

/**
 * @describe Initialize a git repository in `dir` with a single initial commit.
 * The commit is best-effort: a missing git identity fails only the commit, not
 * the init, so a fresh checkout still lands as a valid (if uncommitted) repo.
 * Returns whether `git init` succeeded.
 */
export const initGitRepo = (dir: string): boolean => {
  const opts = { cwd: dir, stdio: "ignore" } as const

  const inited =
    spawn.sync("git", ["init", "-b", "main"], opts).status === 0 ||
    spawn.sync("git", ["init"], opts).status === 0
  if (!inited) return false

  spawn.sync("git", ["add", "-A"], opts)
  spawn.sync("git", ["commit", "-m", "Initial commit from create-extro"], opts)
  return true
}
