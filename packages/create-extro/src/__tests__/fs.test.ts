import { describe, it, expect, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { isDirEmpty, emptyDir, toValidPackageName } from "../fs.js"

const temps: string[] = []
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "create-extro-fs-"))
  temps.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe("isDirEmpty", () => {
  it("treats a missing directory as empty", () => {
    expect(isDirEmpty(path.join(tmp(), "nope"))).toBe(true)
  })

  it("treats a lone .git directory as empty", () => {
    const dir = tmp()
    fs.mkdirSync(path.join(dir, ".git"))
    expect(isDirEmpty(dir)).toBe(true)
  })

  it("reports a directory with other files as non-empty", () => {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, "a.txt"), "x")
    expect(isDirEmpty(dir)).toBe(false)
  })
})

describe("emptyDir", () => {
  it("clears children but preserves .git", () => {
    const dir = tmp()
    fs.mkdirSync(path.join(dir, ".git"))
    fs.writeFileSync(path.join(dir, "a.txt"), "x")
    fs.mkdirSync(path.join(dir, "nested"))
    emptyDir(dir)
    expect(fs.readdirSync(dir)).toEqual([".git"])
  })
})

describe("toValidPackageName", () => {
  it("normalizes names to valid npm package names", () => {
    expect(toValidPackageName("My Extension")).toBe("my-extension")
    expect(toValidPackageName(".hidden")).toBe("hidden")
    expect(toValidPackageName("Cool_Ext!")).toBe("cool-ext")
    expect(toValidPackageName("  spaced  ")).toBe("spaced")
  })

  it("falls back when nothing usable remains", () => {
    expect(toValidPackageName("___")).toBe("extro-extension")
  })
})
