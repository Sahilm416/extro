import { describe, it, expect } from "vitest"
import {
  detectPkgManager,
  installArgs,
  runScript,
  isPkgManager,
} from "../pkg-manager.js"

describe("detectPkgManager", () => {
  it("reads the manager off npm_config_user_agent", () => {
    expect(detectPkgManager("pnpm/10.15.1 npm/? node/v22.0.0")).toBe("pnpm")
    expect(detectPkgManager("yarn/4.0.0 npm/? node/v22")).toBe("yarn")
    expect(detectPkgManager("bun/1.1.0")).toBe("bun")
    expect(detectPkgManager("npm/10.0.0 node/v22")).toBe("npm")
  })

  it("falls back to npm for an absent or unknown agent", () => {
    expect(detectPkgManager("")).toBe("npm")
    expect(detectPkgManager("deno/1.0")).toBe("npm")
  })
})

describe("isPkgManager", () => {
  it("recognizes the four supported managers", () => {
    expect(isPkgManager("pnpm")).toBe(true)
    expect(isPkgManager("deno")).toBe(false)
  })
})

describe("install + run commands", () => {
  it("uses a bare yarn install and `install` elsewhere", () => {
    expect(installArgs("yarn")).toEqual([])
    expect(installArgs("pnpm")).toEqual(["install"])
    expect(installArgs("npm")).toEqual(["install"])
  })

  it("adds `run` only for npm and bun", () => {
    expect(runScript("npm", "dev")).toBe("npm run dev")
    expect(runScript("bun", "dev")).toBe("bun run dev")
    expect(runScript("pnpm", "dev")).toBe("pnpm dev")
    expect(runScript("yarn", "dev")).toBe("yarn dev")
  })
})
