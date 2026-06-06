# Public assets convention

## Context

Extro has no story for shipping static files (an image rendered in the popup, a font, a JSON blob a content script fetches). The only static-file convention today is `icons/` (`icons.ts`, `generators/icons.ts`): a dedicated root directory whose `16/32/48/128.png` map straight to `manifest.icons`. It is single-purpose and says nothing about general assets.

Extro is itself a Vite plugin, and Vite already has a native `publicDir` (default `public/`) that copies files to the output root in prod and serves them at `/` in dev. Nothing in the plugin disables it, so the behavior is latent but untested and unwired: there is no `web_accessible_resources` registration, no parity with the separate dev/prod output dirs, and no guard against a public file clobbering a generated `manifest.json` or `popup.html`.

The hard case is the Content surface. A routable surface (`popup`, `options`, `sidepanel`) loads from the extension origin, so a root-relative `/logo.png` or a `chrome.runtime.getURL("logo.png")` both resolve against the extension and "just work." A content script runs in a host page, so `/logo.png` resolves against the host's origin (wrong), and `chrome.runtime.getURL("logo.png")` only resolves if the file is listed in `web_accessible_resources`. Any public-asset design has to make the Content surface reachable without making the routable surfaces pay for it.

## Decision

Adopt a single project-root `public/` directory, emitted through Extro's own pipeline (not Vite's native copy), with `web_accessible_resources` auto-registered when a Content surface is present.

1. **Directory: `public/`, shared, at project root.** One `public/` for the whole project, not per-Surface. Matches Vite's own `publicDir` default, Next, and Plasmo, so the name carries zero surprise for a Vite/React audience. Files keep their original names and nested structure: `public/logo.png` ships as `/logo.png`, `public/img/x.png` as `/img/x.png`.

2. **`icons/` stays a separate, dedicated convention.** Unchanged. The size-map to `manifest.icons` is genuinely special-purpose; folding it into `public/icons/` would make one magic subpath inside an otherwise dumb directory and buy nothing. `public/` is orthogonal, for everything that is not the extension icon. No migration: `icons.ts` and `generators/icons.ts` keep working as-is.

3. **Emit through Extro's pipeline; disable Vite's native copy.** `config()` sets `publicDir: false` so Vite never copies or serves `public/` itself. Extro owns both paths, mirroring how `icons/` already works:
   - **Prod**: a new `generators/public.ts` (`emitPublicAssets`) reads each file under `public/` and `ctx.emitFile`s it to the same relative path, called from `generateBundle()` next to `emitIcons`.
   - **Dev**: a new `copyPublic(root, outDir)` in `cli/src/dev-assets.ts` mirrors `copyIcons`, copying `public/` into `output/chrome-mv3-dev/` so files resolve at the extension origin in dev exactly as in prod.

   One seam, one set of names, explicit control over collisions and the WAR list. This is the same two-path-but-mirrored shape `icons/` uses, and consistent with it.

4. **Reference mechanism: `chrome.runtime.getURL("logo.png")` is the portable one; root-relative `/logo.png` works on routable surfaces.** `getURL` resolves against the extension origin from every Surface including background and content, so it is the documented, surface-agnostic answer. Root-relative `/logo.png` is a convenience that works on `popup`/`options`/`sidepanel` (extension-origin documents) but not in a content script (host-origin), and the docs say so. Vite's `import logoUrl from "./logo.png"` for a source-colocated asset is untouched and orthogonal: that is for files that live next to code and get hashed, not for `public/`.

5. **`web_accessible_resources`: auto-registered when Content is present, scoped to its matches.** When a Content surface exists, every public file is added to `web_accessible_resources` scoped to the content script's `matches`. Drop a file, `getURL` it from a content script, done. The Content descriptor in `surfaces.ts` already emits a WAR entry for `content.js` under CSUI; public files merge into that same entry. `SurfaceContext` gains a `publicAssets: string[]` field (computed once via `detectPublicAssets(root)` in `generateManifest`) so the descriptor stays pure and never touches the filesystem. When no Content surface exists, nothing is registered: routable surfaces are same-origin and need no WAR. The full manifest stays overridable through `config.manifest.web_accessible_resources`.

6. **Collision guard.** A public file whose flattened name would clobber a generated output is skipped, and a warning is logged. Reserved names: `manifest.json`, `<surface>.html` for each HTML surface, `<surface>.js` for each surface bundle, and the `icons/` tree. Generated output always wins.

7. **Domain vocabulary: introduce "Public asset."** Add the term to `CONTEXT.md` under "Files and discovery" so the convention has a name the docs and code can share.

## Consequences

New: `vite-plugin/src/public.ts` (`detectPublicAssets`), `vite-plugin/src/generators/public.ts` (`emitPublicAssets`), and `copyPublic` in `cli/src/dev-assets.ts`. Touched: `index.ts` (`publicDir: false`, call `emitPublicAssets`, collision guard), `surfaces.ts` (Content WAR merges `ctx.publicAssets`), `manifest.ts`/`surfaces.ts` `SurfaceContext` (+`publicAssets`).

A user drops `public/logo.png`, references it with `chrome.runtime.getURL("logo.png")` from any Surface (or `/logo.png` on a routable one), and it appears verbatim in both `output` dirs, web-accessible from content scripts when a content script exists. The `icons/` convention is undisturbed.

Public assets are not hot-reloaded in dev: `copyPublic` runs once at dev start, exactly like `copyIcons`. Editing a public file mid-session needs an `extro dev` restart. This matches the existing icons behavior; a dev watcher for both can come later if it earns its keep.

## Considered alternatives

- **`assets/` or `static/` as the directory name.** Rejected. Both would require pointing Vite's `publicDir` away from its default, and `public/` is the name a Vite/React/Next user already reaches for. `assets/` also reads like "things I import," which is the opposite of the stable-URL, never-hashed semantics here.
- **Fold `icons/` into `public/icons/`.** Rejected. The size-map detection is special-purpose; merging it conflates two conventions, breaks the existing example, and turns `public/icons/` into a magic subpath. Keeping each single-purpose is the cleaner shape.
- **Lean on Vite's native `publicDir` copy instead of emitting ourselves.** Rejected. We have to scan `public/` anyway for the WAR list and the collision guard, and dev parity needs our own copy into the dev output dir regardless (Vite serves `publicDir` at localhost, not at the extension origin). Owning both paths gives one set of names and removes the ordering ambiguity of a second, uncontrolled copy fighting `emitFile`.
- **Explicit WAR opt-in.** Rejected for v1. Listing every web-accessible file is friction that contradicts the zero-config posture, and `config.manifest.web_accessible_resources` already exists as the escape hatch for anyone who wants to lock it down. Auto-register scoped to the content matches is the "it just works" default; the exposure is bounded to hosts where a content script already runs.
- **Per-Surface `public/` (e.g. `src/app/popup/public/`).** Rejected. Extensions are small and assets are usually shared across surfaces; per-Surface dirs multiply the convention for a split users rarely want, and complicate both the output layout and the WAR scoping.
