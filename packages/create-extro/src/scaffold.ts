import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const TEMPLATES_ROOT = fileURLToPath(new URL("../templates", import.meta.url))

// Dotfiles ship under `_`-prefixed names so npm does not rewrite them at
// publish time (it renames a packaged `.gitignore` to `.npmignore`) and so
// they survive `npm pack`. They are restored to their real names on copy.
const RENAME: Record<string, string> = {
  _gitignore: ".gitignore",
  "_env.example": ".env.example",
}

export const templateDir = (name: string): string =>
  path.join(TEMPLATES_ROOT, name)

interface ScaffoldOptions {
  templateName: string
  targetDir: string
  /** Already-valid package name written into the generated package.json. */
  packageName: string
}

/**
 * @describe Copy a template into the target directory, restoring `_`-prefixed
 * dotfiles to their real names and stamping the chosen package name into
 * package.json. Everything else is copied byte-for-byte.
 */
export const scaffold = ({
  templateName,
  targetDir,
  packageName,
}: ScaffoldOptions): void => {
  copyDir(templateDir(templateName), targetDir, packageName)
}

const copyDir = (srcDir: string, destDir: string, packageName: string): void => {
  fs.mkdirSync(destDir, { recursive: true })

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, RENAME[entry.name] ?? entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, packageName)
    } else if (entry.name === "package.json") {
      writePackageJson(srcPath, destPath, packageName)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const writePackageJson = (
  srcPath: string,
  destPath: string,
  packageName: string,
): void => {
  const manifest = JSON.parse(fs.readFileSync(srcPath, "utf8")) as Record<
    string,
    unknown
  >
  manifest.name = packageName
  fs.writeFileSync(destPath, `${JSON.stringify(manifest, null, 2)}\n`)
}
