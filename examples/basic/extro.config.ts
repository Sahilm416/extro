import { defineConfig } from "@extro/cli"

export default defineConfig({
  name: "Extro Basic Example",
  description: "A basic example extension for Extro",
  permissions: ["storage", "tabs"],
  content: {
    matches: ["https://sahilm416.vercel.app/*"],
  },
})
