export type PkgManager = "npm" | "pnpm" | "yarn" | "bun"

const KNOWN: readonly PkgManager[] = ["npm", "pnpm", "yarn", "bun"]

export const isPkgManager = (name: string): name is PkgManager =>
  (KNOWN as readonly string[]).includes(name)

/**
 * @describe Resolves the package manager that invoked the scaffolder from
 * `npm_config_user_agent` (set by every runner, e.g. `pnpm/10.15.1 ...`), so
 * `pnpm create extro` defaults to pnpm and `npm create` defaults to npm.
 * Falls back to npm when the agent is absent (an unusual direct invocation).
 */
export const detectPkgManager = (
  userAgent: string | undefined = process.env.npm_config_user_agent,
): PkgManager => {
  if (!userAgent) return "npm"
  const name = userAgent.split(" ")[0]?.split("/")[0]
  return name && isPkgManager(name) ? name : "npm"
}

/** The argv that installs dependencies. yarn installs with a bare invocation. */
export const installArgs = (pm: PkgManager): string[] =>
  pm === "yarn" ? [] : ["install"]

/**
 * @describe The command a user types to run a package script. npm and bun need
 * the explicit `run`; pnpm and yarn forward bare script names.
 */
export const runScript = (pm: PkgManager, script: string): string =>
  pm === "npm" || pm === "bun" ? `${pm} run ${script}` : `${pm} ${script}`
