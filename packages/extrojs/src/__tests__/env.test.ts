import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { describe, it, expect, afterEach } from "vitest"

import { loadEnvIntoProcess } from "../env.js"

// A var name unlikely to exist in the real environment, so set/restore is safe.
const KEY = "EXTRO_TEST_GREETING"

const dirs: string[] = []
const make = (files: Record<string, string>): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "extro-env-"))
  dirs.push(dir)
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), body)
  }
  return dir
}

afterEach(() => {
  delete process.env[KEY]
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }))
  dirs.length = 0
})

describe("loadEnvIntoProcess (ADR 0002 build-time tier)", () => {
  it("loads vars from .env in any mode", () => {
    const dir = make({ ".env": `${KEY}=base` })
    loadEnvIntoProcess(dir, "production")
    expect(process.env[KEY]).toBe("base")
  })

  it("stacks .env.development over .env in development mode", () => {
    const dir = make({ ".env": `${KEY}=base`, ".env.development": `${KEY}=dev` })
    loadEnvIntoProcess(dir, "development")
    expect(process.env[KEY]).toBe("dev")
  })

  it("loads .env.production (not .env.development) in production mode", () => {
    const dir = make({
      ".env.development": `${KEY}=dev`,
      ".env.production": `${KEY}=prod`,
    })
    loadEnvIntoProcess(dir, "production")
    expect(process.env[KEY]).toBe("prod")
  })

  it("does not override an existing process.env value (real env wins)", () => {
    process.env[KEY] = "real"
    const dir = make({ ".env": `${KEY}=fromfile` })
    loadEnvIntoProcess(dir, "production")
    expect(process.env[KEY]).toBe("real")
  })
})
