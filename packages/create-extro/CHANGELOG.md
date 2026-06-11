# create-extro

## 0.1.0

### Minor Changes

- 652095a: Add `create-extro`, the scaffolder for new Extro extensions. Run `pnpm create extro` (or the npm/yarn/bun equivalent) to generate a project from the default template, with optional dependency install and git init.
- Redesign the default template. The popup is now a properly sized (360x420) dark surface styled after the Extro landing page, with an Extro x React lockup, a counter card, and the brand terracotta accent. `public/logo.svg` ships the dark-mode brand mark, and the extension icons are regenerated to stay legible on both light and dark toolbars.
- Carry the project name into the generated extension. `pnpm create extro cool-tabs` now stamps `name: "Cool Tabs"` into `extro.config.ts`, so Chrome shows the name you chose instead of a "My Extension" placeholder.

### Patch Changes

- Keep the install spinner animating while dependencies install (the synchronous child process was blocking it), and render all CLI spinners in the brand terracotta instead of the default magenta.
