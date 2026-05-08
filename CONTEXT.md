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
The discovered shape of the user's `src/app/` directory — which Surfaces are present, their Entries, and their Routes.
_Avoid_: project, structure, layout, manifest.

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

**Artifact**:
The static outputs of a build — the Manifest plus one HTML shell per present Routable surface. Composed by `composeArtifacts`.
_Avoid_: output, asset, dist file.

## Relationships

- An **AppTree** has zero or one **Entry** per **Surface**.
- A **Routable surface** has many **Routes**; a **Script surface** has none.
- The **Content surface** has up to two **Modes** (script, CSUI). Other Surfaces have one Mode.
- A **SurfaceDescriptor** declares the **Manifest contribution** and presence rule for exactly one **Surface**.
- A build produces one **Manifest** plus one **HTML shell** per present **Routable surface**.
- A **Runtime module** exists per **Routable surface**; the **Content surface** has its own CSUI mount runtime when CSUI mode is active.

## Example dialogue

> **Dev:** "Where does the `web_accessible_resources` rule for CSUI live? It feels like it's floating outside the Manifest contribution model."
> **Domain expert:** "It belongs on the Content **SurfaceDescriptor**'s **Manifest contribution**. CSUI is a **Mode** of the Content surface, not its own Surface — so the WAR entry is part of what Content contributes when it's in CSUI Mode."

> **Dev:** "Is `page.tsx` an Entry or a Route?"
> **Domain expert:** "The file *is* an **Entry** for a Routable surface. The thing it produces inside the **AppTree** is a **Route**. One Entry, one Route."

## Flagged ambiguities

- **"page"** was used for both the `page.{ts,tsx}` file convention and a rendered Route. Resolved: the file is an **Entry**; the entity is a **Route**.
- **"kind"** appears as `SurfaceDescriptor.kind` (`routable | script`) and was casually used for Modes (script vs CSUI). Resolved: `kind` belongs to SurfaceDescriptor; per-Surface shapes are **Modes**.
- **"csui"** was previously a top-level field on AppTree (`tree.csui`), suggesting it was a sibling concept to the Content surface. Resolved: CSUI is a **Mode** of the Content surface and lives inside the Content slot of the AppTree.
