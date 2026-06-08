import { cac } from "cac"
import { pkg } from "./pkg.js"
import { dev } from "./commands/dev.js"
import { build } from "./commands/build.js"

const cli = cac("extro")

cli.command("dev", "Start the dev server with HMR").action(dev)
cli.command("build", "Build a production extension bundle").action(build)

cli.help()
cli.version(pkg.version)

/**
 * @describe Parses argv and dispatches. cac itself prints --help/--version
 * during parse() (scoped to the matched command), so we only handle the
 * fallback: bare `extro` and unknown commands print top-level help (exit 0
 * when bare, exit 1 when the command was unknown).
 */
export const run = async () => {
  const parsed = cli.parse(process.argv, { run: false })

  // cac has already printed help/version to stdout at this point.
  if (parsed.options.help || parsed.options.version) return

  if (!cli.matchedCommand) {
    cli.outputHelp()
    process.exitCode = process.argv.slice(2).length > 0 ? 1 : 0
    return
  }

  await cli.runMatchedCommand()
}
