import { describe, it, expect, afterEach } from "vitest"

import { asset } from "../asset.js"

const prev = (globalThis as { chrome?: unknown }).chrome
afterEach(() => {
  ;(globalThis as { chrome?: unknown }).chrome = prev
})

describe("asset", () => {
  it("resolves a public path via chrome.runtime.getURL", () => {
    ;(globalThis as { chrome?: unknown }).chrome = {
      runtime: { getURL: (p: string) => `chrome-extension://abc/${p}` },
    }
    expect(asset("logo.svg")).toBe("chrome-extension://abc/logo.svg")
    expect(asset("img/banner.png")).toBe("chrome-extension://abc/img/banner.png")
  })
})
