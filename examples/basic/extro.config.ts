import { defineConfig } from "extrojs"

export default defineConfig({
  name: "Extro Basic Example",
  description: "A basic example extension for Extro",
  permissions: ["storage", "tabs"],
  content: {
    matches: ["https://sahilm416.vercel.app/*"],
  },
})
