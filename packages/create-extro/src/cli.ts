import path from "node:path"
import fs from "node:fs"
import * as p from "@clack/prompts"
import validatePackageName from "validate-npm-package-name"

import { parseArgs } from "./args.js"
import { printHelp } from "./help.js"
import { pkg } from "./pkg.js"
import { brand, brandTag, bold, dim, green } from "./colors.js"
import { TEMPLATES, DEFAULT_TEMPLATE, isTemplate } from "./templates.js"
import {
  detectPkgManager,
  isPkgManager,
  runScript,
  type PkgManager,
} from "./pkg-manager.js"
import { scaffold } from "./scaffold.js"
import {
  isDirEmpty,
  emptyDir,
  toValidPackageName,
  relativeTarget,
} from "./fs.js"
import {
  installDependencies,
  isGitInstalled,
  isInsideGitRepo,
  initGitRepo,
} from "./system.js"

const DEFAULT_DIR = "my-extension"

/** Abort cleanly on Ctrl-C or an explicit cancel. */
const bail = (): never => {
  p.cancel("Cancelled.")
  process.exit(0)
}

const unwrap = <T>(value: T | symbol): T => {
  if (p.isCancel(value)) bail()
  return value as T
}

/** First validation error/warning for a package name, or undefined if valid. */
const packageNameError = (name: string): string | undefined => {
  const { validForNewPackages, errors, warnings } = validatePackageName(name)
  if (validForNewPackages) return undefined
  return (errors ?? warnings ?? ["is not a valid package name"])[0]
}

export const run = async (): Promise<void> => {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) return printHelp()
  if (opts.version) {
    console.log(pkg.version)
    return
  }

  const cwd = process.cwd()
  const interactive = Boolean(process.stdout.isTTY) && !opts.yes

  p.intro(`${brandTag(" create-extro ")} ${dim(`v${pkg.version}`)}`)

  if (opts.unknown.length) {
    p.log.warn(`Ignoring unknown ${plural(opts.unknown.length, "option")}: ${opts.unknown.join(", ")}`)
  }

  // Package manager: an explicit --pm wins, otherwise infer from the runner.
  let pm: PkgManager = detectPkgManager()
  if (opts.packageManager) {
    if (!isPkgManager(opts.packageManager)) {
      p.log.error(`Unknown package manager "${opts.packageManager}". Use npm, pnpm, yarn, or bun.`)
      process.exit(1)
    }
    pm = opts.packageManager
  }

  // 1. Target directory + package name.
  let dirInput = opts.projectName
  if (dirInput === undefined) {
    if (!interactive) {
      dirInput = DEFAULT_DIR
    } else {
      dirInput = unwrap(
        await p.text({
          message: "Where should we create your extension?",
          placeholder: `./${DEFAULT_DIR}`,
          defaultValue: DEFAULT_DIR,
          validate: (value) => {
            const input = (value ?? "").trim() || DEFAULT_DIR
            const name = toValidPackageName(path.basename(path.resolve(input)))
            return packageNameError(name)
          },
        }),
      ).trim()
    }
  }
  dirInput = dirInput || DEFAULT_DIR

  const targetDir = path.resolve(cwd, dirInput)
  const rel = relativeTarget(cwd, targetDir)
  const packageName = toValidPackageName(path.basename(targetDir))

  const nameError = packageNameError(packageName)
  if (nameError) {
    p.log.error(`Cannot use "${packageName}" as a package name: it ${nameError}.`)
    process.exit(1)
  }

  // 2. Resolve a conflicting, non-empty target directory.
  if (!isDirEmpty(targetDir)) {
    if (opts.overwrite) {
      emptyDir(targetDir)
    } else if (!interactive) {
      p.log.error(`${bold(rel)} is not empty. Pass --overwrite to replace its contents.`)
      process.exit(1)
    } else {
      const choice = unwrap(
        await p.select({
          message: `${bold(rel)} is not empty. How should we proceed?`,
          initialValue: "cancel",
          options: [
            { value: "cancel", label: "Cancel" },
            { value: "overwrite", label: "Remove existing files and continue" },
            { value: "ignore", label: "Ignore files and continue", hint: "may conflict" },
          ],
        }),
      )
      if (choice === "cancel") bail()
      if (choice === "overwrite") emptyDir(targetDir)
    }
  }

  // 3. Template.
  let template = opts.template ?? DEFAULT_TEMPLATE
  if (opts.template) {
    if (!isTemplate(opts.template)) {
      p.log.error(`Unknown template "${opts.template}". Choose from: ${TEMPLATES.map((t) => t.name).join(", ")}.`)
      process.exit(1)
    }
  } else if (interactive && TEMPLATES.length > 1) {
    template = unwrap(
      await p.select({
        message: "Which template?",
        initialValue: DEFAULT_TEMPLATE,
        options: TEMPLATES.map((t) => ({ value: t.name, label: t.label, hint: t.hint })),
      }),
    )
  }

  // 4. Install dependencies?
  let doInstall = opts.install
  if (doInstall === undefined) {
    doInstall = interactive
      ? unwrap(await p.confirm({ message: `Install dependencies with ${brand(pm)}?`, initialValue: true }))
      : false
  }

  // 5. Initialize git? Never re-init when already inside a repo.
  const gitAvailable = isGitInstalled() && !isInsideGitRepo(cwd)
  let doGit = opts.git
  if (doGit === undefined) {
    doGit =
      interactive && gitAvailable
        ? unwrap(await p.confirm({ message: "Initialize a git repository?", initialValue: true }))
        : false
  }
  if (doGit && !gitAvailable) {
    p.log.warn("Skipping git: already inside a repository or git is not installed.")
    doGit = false
  }

  // 6. Write the template.
  const scaffolding = p.spinner()
  scaffolding.start(`Scaffolding the ${brand(template)} template`)
  try {
    scaffold({ templateName: template, targetDir, packageName })
  } catch (error) {
    scaffolding.stop("Failed to scaffold the template")
    throw error
  }
  scaffolding.stop(`Created ${bold(rel)}`)

  // 7. Install.
  if (doInstall) {
    const installing = p.spinner()
    installing.start(`Installing dependencies with ${brand(pm)}`)
    if (installDependencies(pm, targetDir)) {
      installing.stop("Installed dependencies")
    } else {
      installing.stop("Could not install dependencies")
      p.log.warn(`Run ${brand(installCommand(pm))} yourself to finish setup.`)
      doInstall = false
    }
  }

  // 8. Git.
  if (doGit) {
    const initializing = p.spinner()
    initializing.start("Initializing a git repository")
    initializing.stop(
      initGitRepo(targetDir)
        ? "Initialized a git repository"
        : "Could not initialize git",
    )
  }

  // 9. Next steps.
  const steps: string[] = []
  if (rel !== ".") steps.push(`cd ${rel}`)
  if (!doInstall) steps.push(installCommand(pm))
  steps.push(runScript(pm, "dev"))

  p.note(
    steps.map((step, i) => `${dim(`${i + 1}.`)} ${brand(step)}`).join("\n"),
    "Next steps",
  )

  p.log.message(
    `Then open ${bold("chrome://extensions")}, enable Developer mode, and ${bold("Load unpacked")}\n${dim(`from ${rel === "." ? "" : `${rel}/`}output/chrome-mv3-dev`)}.`,
  )

  p.outro(`${green("✓")} Welcome to Extro. ${dim("https://github.com/Sahilm416/extro")}`)
}

const installCommand = (pm: PkgManager): string =>
  pm === "yarn" ? "yarn" : `${pm} install`

const plural = (count: number, word: string): string =>
  count === 1 ? word : `${word}s`
