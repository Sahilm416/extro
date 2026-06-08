# Extro

Extro is a Chrome-extension framework: file-based entrypoints under `src/app/`, automatic Manifest V3 generation, React routing. This document defines the project-specific vocabulary.

## Language

### Surfaces

**Surface**:
A Chrome-extension-level division of an Extro project. Today: `popup`, `options`, `sidepanel`, `background`, `content`.
_Avoid_: page, view, target, entry point.

**Routable surface**:
A Surface that hosts React routes and renders into an HTML shell. `popup`, `options`, `sidepanel`.
_Avoid_: UI surface, React surface.

**Script surface**:
A Surface that ships as a single bundle with no nesting. `background`, `content`.
_Avoid_: script entry, worker, script.

**Mode** (of a Surface):
A distinct shape the same Surface can take. Today only Content has Modes — script-only, CSUI-only, or both.
_Avoid_: variant, kind (overloaded with `SurfaceDescriptor.kind`).

### Files and discovery

**Entry**:
The user-authored source file for a Surface — `src/app/<surface>/page.{ts,tsx}` for routables, `src/app/<surface>/index.{ts,tsx}` for scripts.
_Avoid_: source, input, file.

**Route**:
A page within a Routable surface, derived from a nested `page.{ts,tsx}` file. May be static or dynamic (with `[id]` params).
_Avoid_: page, screen, view.

**CSUI** (Content-Script UI):
A Mode of the Content surface where `src/app/content/page.tsx` is auto-mounted into a shadow DOM on host pages. Not a separate Surface.
_Avoid_: content UI, in-page UI, content react.

**AppTree**:
The discovered shape of the user's `src/app/` directory — which Surfaces are present, their Entries, and their Routes. Its per-Routable-surface slot _is_ that surface's **Route manifest**; Script surfaces live under `tree.scripts`.
_Avoid_: project, structure, layout, manifest.

**Public asset**:
A static file in the project-root `public/` directory, emitted to the output root with its original name and referenced by stable URL (`chrome.runtime.getURL("logo.png")`, or `/logo.png` on a Routable surface). Distinct from an Entry (not a Surface) and from a source-colocated imported asset (not hashed). The extension icon stays its own `icons/` convention, not a Public asset.
_Avoid_: static file, resource, public file, bundled asset.

**Asset inventory**:
The discovered set of static-file inputs a build ships: the extension's recognized icons (the `16/32/48/128` sizes under `icons/`) plus the project's Public assets (already partitioned from the names a build generates). Produced by one `discoverAssets(root, tree)` pass and passed as data into manifest generation (which stays pure and never reads the filesystem) and the emit/copy paths. The icon set in the inventory is exactly what ships, so `manifest.icons` and the emitted icon files cannot diverge. Distinct from an **Artifact** (a build's outputs) and broader than a **Public asset** (one input kind).
_Avoid_: assets, static files, asset manifest, resources.

### Environment

**Public env var**:
An `EXTRO_PUBLIC_*` variable, statically inlined into every Surface bundle through `import.meta.env`. Declaring one is declaring "this value ships to users." The only env tier a Surface can read.
_Avoid_: client env, runtime env, exposed var.

**Build-time env var**:
Any other variable, read at build time through `process.env` by `extro.config.ts` and manifest generation, never inlined into a Surface. `EXTRO_*` is reserved for framework-recognized ones (today only `EXTRO_CRX_KEY`, which maps to `manifest.key`). "Build-time" means not auto-shipped, not secret: an extension has no server, so nothing is truly private.
_Avoid_: private env, server env, secret.

### Routing primitives

**Segment**:
A directory level under a Routable surface (`popup/settings/` is a Segment). Segments nest; a Route belongs to its deepest Segment.
_Avoid_: folder, route group, level.

**Layout**:
A per-Segment component (`layout.tsx`) that wraps its Segment's Route subtree. Layouts compose innermost-first; the surface-root Layout wraps everything.
_Avoid_: wrapper, shell (HTML shell is a different term), template.

**Error boundary**:
A per-Segment component (`error.tsx`) rendered when its Segment's Route or a descendant throws. Sits inside its sibling Layout, so it never catches that Layout's own errors.
_Avoid_: error page, catch, fallback.

**Not-found fallback**:
The per-Surface component (`not-found.tsx`) rendered when a hash matches no Route in that Routable surface. One per Surface, not per Segment.
_Avoid_: 404 page, missing route, catch-all.

**Routing primitive**:
Collective term for Layout, Error boundary, and Not-found fallback: the convention files that shape how a Route renders. Distinct from an Entry (the Route's own source) and from the Route itself.
_Avoid_: special file, boundary file, meta file.

### Build outputs

**SurfaceDescriptor**:
The single record per Surface that owns its scan conventions, presence rules, and Manifest contribution. Lives in `surfaces.ts`.
_Avoid_: surface config, surface spec, plugin.

**Manifest contribution**:
The fragment a Surface adds to the generated `manifest.json` when present (e.g. `action.default_popup`, `content_scripts`, `web_accessible_resources`).
_Avoid_: manifest fragment, manifest entry, manifest field.

**HTML shell**:
The generated `<surface>.html` file that hosts a Routable surface — a minimal page that loads the Surface's runtime module.
_Avoid_: page, host page, template.

**Runtime module**:
A virtual module the build emits per Routable surface — `virtual:extro/runtime/<surface>` (the React mount shim) and `virtual:extro/routes/<surface>` (the routes array).
_Avoid_: runtime, shim, generated module.

**Route manifest**:
The serializable, per-Routable-surface description of its Routes, each Route's boundary chain, and its Not-found fallback / surface-root Layout. It _is_ the per-surface slot of the **AppTree** (`tree.surfaces[<surface>]`); the scanner builds it directly and the single codegen that emits the `virtual:extro/routes/<surface>` Runtime module consumes it. It is the typed contract between build and runtime; the runtime `Route` type is derived from it. Lives in `@extrojs/types`.
_Avoid_: routes data, route table, route config, serialized routes.

**Artifact**:
The static outputs of a build — the Manifest plus one HTML shell per present Routable surface. Composed by `composeArtifacts`.
_Avoid_: output, asset, dist file.

### Dev mode

**Dev reaction**:
The framework's decision about what to do when a watched `src/app` file changes during `extro dev`, computed by the pure functions in `dev-reactions.ts`. Two shapes. The **script reaction** (`classifyScriptChange` plus the dirty reducer) decides which Script surfaces a rebuild touches, so a background-only edit never reloads tabs and a content-only edit never reloads the extension; shared code dirties both. The **tree reaction** (`decideTreeReaction`) diffs two AppTrees into `restart` (a Surface was born mid-session, so its frozen Rollup input needs a fresh session), `invalidate` (a Routable surface whose Route manifest changed), or `noop`. The watchers own the effects (rescan, broadcast, module invalidation); the reaction itself performs no I/O.
_Avoid_: rebuild signal, hot update, watch handler.

### Distribution

**Published package**:
The single npm artifact a user installs — `extrojs`. It folds the framework's entire user-facing surface behind Export subpaths (the Next.js model: one `next` install exposing `next/link`, `next/navigation`). The npm-facing counterpart of an **Artifact** (which is the Chrome-facing output). A user adds one dependency and never names an `@extrojs/*` package.
_Avoid_: package (ambiguous with Workspace package), the lib, the framework.

**Workspace package**:
An internal `packages/*` build unit (`@extrojs/router`, `@extrojs/core`, `@extrojs/vite-plugin`, ...). A build-modularity boundary, not a user-facing install target. Many Workspace packages compose into one **Published package**.
_Avoid_: module, subpackage, lib.

## Relationships

- An **AppTree** has zero or one **Entry** per **Surface**.
- A **Routable surface** has many **Routes**; a **Script surface** has none.
- The **Content surface** has up to two **Modes** (script, CSUI). Other Surfaces have one Mode.
- A **SurfaceDescriptor** declares the **Manifest contribution** and presence rule for exactly one **Surface**.
- A build produces one **Manifest** plus one **HTML shell** per present **Routable surface**.
- An **Asset inventory** is discovered once per build from `icons/` and `public/`; manifest generation and the emit/copy paths consume it as data instead of reading the filesystem themselves.
- A **Runtime module** exists per **Routable surface**; the **Content surface** has its own CSUI mount runtime when CSUI mode is active.
- **Segments** nest under a **Routable surface**; a **Route** belongs to its deepest **Segment**.
- A **Layout** and an **Error boundary** are per-**Segment** and compose innermost-first; an **Error boundary** is nested inside its sibling **Layout**.
- A **Not-found fallback** is per-**Routable surface**, not per-**Segment**.
- A **Dev reaction** is computed from a changed path (script side) or an **AppTree** diff (routable side); it performs no I/O, so the watcher that triggered it owns the effect.

## Example dialogue

> **Dev:** "Where does the `web_accessible_resources` rule for CSUI live? It feels like it's floating outside the Manifest contribution model."
> **Domain expert:** "It belongs on the Content **SurfaceDescriptor**'s **Manifest contribution**. CSUI is a **Mode** of the Content surface, not its own Surface — so the WAR entry is part of what Content contributes when it's in CSUI Mode."

> **Dev:** "Is `page.tsx` an Entry or a Route?"
> **Domain expert:** "The file *is* an **Entry** for a Routable surface. The thing it produces inside the **AppTree** is a **Route**. One Entry, one Route."

## Flagged ambiguities

- **"page"** was used for both the `page.{ts,tsx}` file convention and a rendered Route. Resolved: the file is an **Entry**; the entity is a **Route**.
- **"kind"** appears as `SurfaceDescriptor.kind` (`routable | script`) and was casually used for Modes (script vs CSUI). Resolved: `kind` belongs to SurfaceDescriptor; per-Surface shapes are **Modes**.
- **"csui"** was previously a top-level field on AppTree (`tree.csui`), suggesting it was a sibling concept to the Content surface. Resolved: CSUI is a **Mode** of the Content surface and lives inside the Content slot of the AppTree.
- **"layout"** could read as the **HTML shell** or the generic word in `_Avoid_` lists. Resolved: a **Layout** is a Segment-level **Routing primitive** (`layout.tsx`); the **HTML shell** is the generated host page. `layout.tsx`/`error.tsx`/`not-found.tsx` are **Routing primitives**, not **Entries** and not **Routes**.
