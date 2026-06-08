import { describe, it, expect } from "vitest"
import { parseArgs } from "../args.js"

describe("parseArgs", () => {
  it("reads the first positional as the project name", () => {
    expect(parseArgs(["my-ext"]).projectName).toBe("my-ext")
  })

  it("only takes the first positional as the name", () => {
    expect(parseArgs(["a", "b"]).projectName).toBe("a")
  })

  it("parses the template via --template, -t, and --template=", () => {
    expect(parseArgs(["--template", "minimal"]).template).toBe("minimal")
    expect(parseArgs(["-t", "default"]).template).toBe("default")
    expect(parseArgs(["--template=minimal"]).template).toBe("minimal")
  })

  it("parses the package manager via --pm and --package-manager", () => {
    expect(parseArgs(["--pm", "bun"]).packageManager).toBe("bun")
    expect(parseArgs(["--package-manager=yarn"]).packageManager).toBe("yarn")
  })

  it("distinguishes --install from --no-install", () => {
    expect(parseArgs(["--install"]).install).toBe(true)
    expect(parseArgs(["--no-install"]).install).toBe(false)
    expect(parseArgs([]).install).toBeUndefined()
  })

  it("distinguishes --git from --no-git", () => {
    expect(parseArgs(["--git"]).git).toBe(true)
    expect(parseArgs(["--no-git"]).git).toBe(false)
  })

  it("parses boolean and alias flags", () => {
    const opts = parseArgs(["app", "--overwrite", "-y"])
    expect(opts.overwrite).toBe(true)
    expect(opts.yes).toBe(true)
    expect(parseArgs(["-h"]).help).toBe(true)
    expect(parseArgs(["--version"]).version).toBe(true)
  })

  it("collects unknown flags without consuming the name", () => {
    const opts = parseArgs(["app", "--bogus"])
    expect(opts.projectName).toBe("app")
    expect(opts.unknown).toEqual(["--bogus"])
  })
})
