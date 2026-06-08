# `create-extro` scaffolder

## Context

Getting started with Extro meant a manual checklist: add `extrojs react react-dom`, write `tsconfig.json` and `extro.config.ts`, create `src/app/<surface>/page.tsx`, drop in icons. Every framework users reach for solves this with a `create-*` package run through the package-manager initializer convention (`npm create`, `pnpm create`, `yarn create`, `bun create`): `create-next-app`, `create-vite`, `create-astro`. Extro had none, so the fastest on-ramp was cloning `examples/basic`.

ADR 0009 established the invariant that a project installs exactly one Extro package (`extrojs`). A scaffolder must not erode that.

## Decision

Ship a second published package, `create-extro` (`packages/create-extro`), invoked as `pnpm create extro` / `npm create extro@latest`.

1. **A scaffolder, not a subcommand.** `create-extro` is a standalone package, not an `extro new` command inside `extrojs`. This keeps the installed framework free of scaffolding dependencies (`@clack/prompts`, `cross-spawn`) and the bundled `templates/`, and it matches what users expect from `pnpm create <name>`. It is *run*, not installed: the project it generates depends only on `extrojs`, so the ADR 0009 invariant holds.

2. **One minimal starter, real files copied verbatim.** `templates/<name>/` holds actual project files; scaffolding is a recursive copy, not codegen. There is a single `default` starter: a popup and a background service worker. Extro's premise is that a surface is a file you drop under `src/app/`, so a scaffold that pre-generates every surface (popup, options, side panel, content, background, nested and dynamic routes) is a demo, not a starting point, and it contradicts the convention it is supposed to teach. The starter ships the canonical surface plus the background script; the file-drop convention and the docs cover the rest. This follows `create-next-app` (one page) and `create-vite` (one component) rather than a kitchen sink. The `TEMPLATES` registry stays a list so archetype starters can be added later without reshaping the call sites. Real files are readable and testable by copying them into a temp dir and building.

3. **`package.json` is the only transformed file.** Its `name` is stamped from the target directory; everything else is copied byte-for-byte. Templates own their dependency versions (the `create-vite` model) rather than having the framework version injected from the tool, so a template tweak does not couple to a framework release.

4. **Dotfiles ship `_`-prefixed.** `_gitignore` and `_env.example` are restored to their real names on copy. npm rewrites a packaged `.gitignore` to `.npmignore` and may drop leading-dot files from the tarball; the `_` prefix keeps them publishable (again the `create-vite` convention).

5. **Top-tier prompt UX, minimal deps.** `@clack/prompts` drives the interactive flow; `picocolors` reuses the framework CLI's truecolor terracotta so the two read as one voice; `cross-spawn` runs install and git; `validate-npm-package-name` validates the name. The argv parser is hand-rolled: a scaffolder's UX lives in its prompts, so a parser dependency earns little and a custom parser keeps `--help` fully branded.

6. **Plain `tsc`, ESM, non-interactive fallback.** The build is `tsc` only (no bundler), matching the repo. `templates/` lives outside `src/`, so `tsc` never compiles it. When stdout is not a TTY or `--yes` is passed, prompts are skipped and flags plus defaults drive the run, so CI and one-liners work.

## Consequences

`pnpm create extro` is the documented on-ramp; the manual `pnpm add extrojs` path remains for existing projects. There are now two published packages, but only `extrojs` is ever a project dependency. `create-extro` versions independently on its own line, starting at `0.1.0`: it is a separate tool with its own changelog, not pinned to the framework version (the `create-next-app` / `create-vite` model). The kitchen-sink demonstration of every surface lives in `examples/basic`, not the template, so the two do not overlap and there is little to keep in sync; a scaffold integration test (copy the template, build it) guards the starter.

## Considered alternatives

- **`extro new` subcommand in `extrojs`.** Rejected: it bloats the one installed package with prompt/spawn dependencies and template bytes that only matter once, and it forgoes the `pnpm create extro` convention users already know.
- **Code-generated templates / a template DSL.** Rejected: emitting files from strings is harder to read and review than real files, and it cannot be validated by simply building the output.
- **Injecting the framework version from the tool version.** Rejected: it couples every template change to a framework bump. Templates owning their own versions (create-vite) keeps the two independent.
- **A full arg parser (`cac`, `commander`).** Rejected: the interactive prompts are the interface; a dependency for flag parsing adds surface area without improving the experience.
