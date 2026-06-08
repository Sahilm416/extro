export interface CliOptions {
  /** First positional: the target directory (and, by basename, the package name). */
  projectName?: string
  template?: string
  packageManager?: string
  install?: boolean
  git?: boolean
  overwrite?: boolean
  yes?: boolean
  help?: boolean
  version?: boolean
  /** Flags we did not recognize, surfaced as a warning by the CLI. */
  unknown: string[]
}

/**
 * @describe Hand-rolled argv parser. A scaffolder's UX lives in its prompts,
 * not its flags, so we avoid a parser dependency and keep full control over
 * `--help`. Supports `--flag`, `--no-flag`, `--key value`, `--key=value`, and
 * the short aliases `-t`, `-y`, `-h`, `-v`.
 */
export const parseArgs = (argv: string[]): CliOptions => {
  const opts: CliOptions = { unknown: [] }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (!arg.startsWith("-")) {
      if (opts.projectName === undefined) opts.projectName = arg
      continue
    }

    let key = arg
    let inlineValue: string | undefined
    const eq = arg.indexOf("=")
    if (arg.startsWith("--") && eq !== -1) {
      key = arg.slice(0, eq)
      inlineValue = arg.slice(eq + 1)
    }

    const takeValue = (): string | undefined =>
      inlineValue !== undefined ? inlineValue : argv[++i]

    switch (key) {
      case "-h":
      case "--help":
        opts.help = true
        break
      case "-v":
      case "--version":
        opts.version = true
        break
      case "-y":
      case "--yes":
        opts.yes = true
        break
      case "-t":
      case "--template":
        opts.template = takeValue()
        break
      case "--pm":
      case "--package-manager":
        opts.packageManager = takeValue()
        break
      case "--install":
        opts.install = true
        break
      case "--no-install":
        opts.install = false
        break
      case "--git":
        opts.git = true
        break
      case "--no-git":
        opts.git = false
        break
      case "--overwrite":
        opts.overwrite = true
        break
      default:
        opts.unknown.push(arg)
    }
  }

  return opts
}
