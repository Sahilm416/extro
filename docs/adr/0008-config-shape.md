# Config shape and manifest layering

## Context

`extro.config.ts` had grown a handful of fields (`name`, `permissions`, `manifest`, ...) without a stated organizing principle. Before the second release we wanted a shape we would not have to churn: clear about which manifest fields are promoted to the top level versus reached through an escape hatch, and with room for subsystem config (dev server, output, future build/vite/targets) to slot in without reshuffling the top level.

Two concrete needs forced the issue: configurable dev ports (the bridge WebSocket port was hardcoded to 9012, which collides when two sessions run), and a clean way to tamper with the generated manifest beyond the static `manifest` object.

The alternative model on the table was WXT's: put *everything* manifest-related under a single `manifest` key (object or function) and keep the top level purely for framework config.

## Decision

Keep **promotion** with a small, curated set of top-level fields, and define manifest resolution as explicit layers.

1. **Promoted fields stay top-level.** `name`, `version`, `description`, `icons`, `permissions`, `hostPermissions`, and per-surface `content.matches`. These are the common 90% and the curated set is intentionally small. Identity fields fall back to `package.json`. Promotion is what makes Extro feel like a framework rather than a thin manifest wrapper.

2. **Manifest fields resolve in layers, each overriding the last:**

   ```
   framework defaults  →  promoted fields  →  manifest {}  →  transformManifest()
   ```

   You reach for the lowest layer that does the job. `manifest` is a raw `Partial<ManifestV3>` merged over the promoted fields. `transformManifest(manifest)` is the final imperative hook: it sees the fully generated manifest (including the dev CSP and the CRX key) and may mutate it in place or return a replacement. It is synchronous. This is the clean callback the release needed, and it sits *beside* `manifest` rather than overloading it, so "merge this" and "transform this" stay distinct.

3. **`ManifestV3` gains a `[key: string]: unknown` index signature.** A tamper hook is most useful for fields Extro does not model (`minimum_chrome_version`, `commands`, ...). The index signature lets both `manifest` and `transformManifest` set any field without casting, while keeping the known fields strongly typed.

4. **Subsystem config is grouped under its own object.** `dev` ships now (`port`, `bridgePort`, `strictPort`); future `build`, `vite` (escape hatch), and browser `targets` follow the same pattern. The public dev field is `bridgePort` (the internal plumbing keeps calling it `signalPort`); `port`/`strictPort` pass through to Vite's dev server.

5. **`outDir` is the base output directory, not the final one.** Default `output`. Extro writes `<outDir>/chrome-mv3-dev` and `<outDir>/chrome-mv3-prod` underneath. Keeping the `chrome-mv3-<mode>` subdir preserves the load-bearing dev/prod separation and leaves room for other targets (`<outDir>/firefox-mv3-prod`) when multi-browser lands.

## Consequences

Touched: `packages/types/src/index.ts` (the `ExtroConfig` reshape + `ManifestV3` index signature), `packages/vite-plugin/src/manifest.ts` (apply `transformManifest` last), `packages/cli/src/commands/{dev,build}.ts` and a new `paths.ts` (`outputDir` from `config.outDir`, dev port/bridgePort/strictPort). A new `configuration.mdx` documents the shape.

The teachable rule is one sentence: manifest fields layer defaults → promoted → `manifest` → `transformManifest`, and subsystem config lives in named groups. New fields have an obvious home, so the shape should not need to churn again. The one sharp edge: `transformManifest` runs after the dev CSP, so setting CSP from it overrides the dev server's; this is documented.

## Considered alternatives

- **WXT-style: everything under `manifest`.** Rejected. It is more uniform, but it throws away the promoted-field DX that makes the common case (`permissions: [...]`) clean, and Extro already had promotion. We keep it and make the layering explicit instead.
- **Overload `manifest` as object | function.** Rejected. One key carrying both "merge this object" and "transform the result" muddies the mental model. Two distinct keys (`manifest`, `transformManifest`) compose more clearly.
- **Async `transformManifest`.** Deferred. It would ripple `generateManifest`/`composeArtifacts` to async for a case (awaiting inside manifest generation) that is rare. Revisit if a real need appears.
- **`outDir` as the literal final directory.** Rejected. With separate dev and prod outputs, a single literal dir cannot hold both; making it the base keeps the parallel structure and the target naming.
