import { brand, brandTag, bold, dim } from "./colors.js"
import { pkg } from "./pkg.js"
import { TEMPLATES } from "./templates.js"

export const printHelp = (): void => {
  const templates = TEMPLATES.map((t) => t.name).join(", ")
  const lines = [
    "",
    `  ${brandTag(" create-extro ")} ${dim(`v${pkg.version}`)}`,
    "",
    `  Scaffold a new ${brand("Extro")} extension.`,
    "",
    `  ${bold("Usage")}`,
    `    ${brand("create-extro")} [directory] [options]`,
    "",
    `  ${bold("Options")}`,
    `    -t, --template <name>   Template to use: ${dim(templates)}`,
    `        --pm <manager>      Force a package manager: ${dim("npm, pnpm, yarn, bun")}`,
    `        --install           Install dependencies`,
    `        --no-install        Skip installing dependencies`,
    `        --git               Initialize a git repository`,
    `        --no-git            Skip git initialization`,
    `        --overwrite         Overwrite the target directory if it is not empty`,
    `    -y, --yes               Accept defaults and skip the prompts`,
    `    -h, --help              Show this help`,
    `    -v, --version           Show the version`,
    "",
    `  ${bold("Examples")}`,
    `    ${dim("pnpm create extro")}`,
    `    ${dim("pnpm create extro my-extension")}`,
    `    ${dim("npm create extro@latest my-extension -- --no-install")}`,
    "",
  ]
  console.log(lines.join("\n"))
}
