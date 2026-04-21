import { defineConfig } from "extro"

export default defineConfig({
  name: "Extro Basic Example",
  description: "A basic example extension for Extro",
  permissions: ["storage", "tabs"],
  hostPermissions: ["<all_urls>"],
})
