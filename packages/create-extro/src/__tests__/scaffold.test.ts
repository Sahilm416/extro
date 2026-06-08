import { describe, it, expect, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { scaffold } from "../scaffold.js"
import { TEMPLATES } from "../templates.js"

const temps: string[] = []
const target = (): string => {
  const dir = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "create-extro-")),
    "app",
  )
  temps.push(dir)
  return dir
}

const read = (dir: string, rel: string): string =>
  fs.readFileSync(path.join(dir, rel), "utf8")

afterEach(() => {
  for (const dir of temps.splice(0))
    fs.rmSync(path.dirname(dir), { recursive: true, force: true })
})

describe("scaffold", () => {
  it.each(TEMPLATES.map((t) => t.name))(
    "writes a buildable %s project",
    (template) => {
      const dir = target()
      scaffold({ templateName: template, targetDir: dir, packageName: "demo" })

      // package.json gets the chosen name and references the framework.
      const pkg = JSON.parse(read(dir, "package.json"))
      expect(pkg.name).toBe("demo")
      expect(pkg.dependencies.extrojs).toBeTruthy()

      // Dotfiles are restored from their _-prefixed template names.
      expect(fs.existsSync(path.join(dir, ".gitignore"))).toBe(true)
      expect(fs.existsSync(path.join(dir, ".env.example"))).toBe(true)
      expect(fs.existsSync(path.join(dir, "_gitignore"))).toBe(false)

      // Every template ships a popup, a background worker, config, and icons.
      expect(fs.existsSync(path.join(dir, "src/app/popup/page.tsx"))).toBe(true)
      expect(fs.existsSync(path.join(dir, "src/app/background/index.ts"))).toBe(true)
      expect(fs.existsSync(path.join(dir, "extro.config.ts"))).toBe(true)
      expect(fs.existsSync(path.join(dir, "icons/128.png"))).toBe(true)
      expect(fs.existsSync(path.join(dir, "public/logo.svg"))).toBe(true)
    },
  )

  it("keeps the starter minimal: no extra surfaces pre-generated", () => {
    const dir = target()
    scaffold({ templateName: "default", targetDir: dir, packageName: "demo" })
    for (const surface of ["content", "options", "sidepanel"]) {
      expect(fs.existsSync(path.join(dir, "src/app", surface))).toBe(false)
    }
  })
})
