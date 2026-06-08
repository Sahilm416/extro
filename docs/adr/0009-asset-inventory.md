# Asset inventory: one discovery pass feeds a pure manifest

## Status

Accepted. From an `/improve-codebase-architecture` grilling session
(Candidate 1, a follow-on review after ADR 0004). It relocates static-file
discovery behind one seam and makes the manifest generator pure; it changes one
behavior (the icon reconcile, §4).

## Context

`generateManifest` advertised itself as a pure projection of
`(tree, config, pkg, dev)`, and ADR 0001 explicitly wants each Surface's
Manifest contribution "pure-testable against a hand-built `(tree, config,
dev)`." It was not pure. Inside, it called `collectPublicAssets(root, tree)` (a
`public/` directory walk) and `detectIcons(root)` (a stack of `existsSync`
probes). The `root: string` parameter was the tell: it existed only so the
function could reach the disk. `manifest.test.ts` passed only because
`tmpdir()` happened to contain no `public/` or `icons/`, so both probes
returned empty. "A project with icons yields `manifest.icons`" and "Public
assets plus a Content surface yield `web_accessible_resources`" could not be
exercised through the interface without staging files on disk.

Two further frictions sat behind the same reads:

1. **`public/` was walked three times.** `collectPublicAssets` was called in
   `manifest.ts` (the WAR list), in `generators/public.ts` (prod emit), and in
   `cli/dev-assets.ts` (dev copy). It already returned a clean value; the only
   defect was that nothing owned the single discovery.
2. **Two divergent notions of "an icon."** `detectIcons` recognized exactly the
   `16/32/48/128` sizes for `manifest.icons`, while `emitIcons` and `copyIcons`
   `readdir`'d the whole `icons/` directory and shipped every file. A stray
   `icons/64.png` shipped but was never referenced in the manifest.

## Decision

1. **Introduce the Asset inventory: one discovery owner.** A new
   `asset-inventory.ts` exports `discoverAssets(root, tree)`, which composes the
   existing `detectIcons` and `collectPublicAssets` into one value
   (`{ icons: Record<size, path> | null; public: PublicAssets }`). The
   filesystem is walked once per build path. See the `CONTEXT.md` "Asset
   inventory" term.

2. **The manifest core takes the inventory as data and drops `root`.**
   `generateManifest`, `composeArtifacts`, and `AssetOptions` lose `root` and
   gain `inventory`. `generateManifest` becomes pure: its inputs are its test
   surface. `root` survives only at the two impure edges (`generateBundle` in
   the plugin, `writeDevAssets` in the CLI), where it is needed to run discovery
   and to read bytes for emission. Impurity at the edge, a pure core.

3. **The emit/copy paths consume the inventory slice, not the disk.**
   `emitIcons`/`emitPublicAssets` (prod) and `copyIcons`/`copyPublic` (dev) take
   the inventory's icon map / public partition and read only bytes. The walk and
   the partition are no longer repeated.

4. **Reconcile to one notion of "icon."** The inventory's icon set is the
   recognized-sizes set, and that same set is what ships: `emitIcons`/`copyIcons`
   iterate `Object.values(inventory.icons)` instead of `readdir`. `manifest.icons`
   and the emitted icon files cannot diverge. This is a behavior change: a
   non-canonical `icons/64.png` no longer ships.

5. **The emit-vs-copy mechanism stays untouched.** Prod still emits through
   Rollup's `ctx.emitFile`; dev still copies through `fs.copyFile`. Unifying
   those two sinks behind one `EmitSink` is a separate seam (the review's
   Candidate 4) and would reopen ADR 0004's deliberate "two-path-but-mirrored"
   choice. Out of scope here.

6. **`EXTRO_CRX_KEY` stays a `process.env` read in `generateManifest`.** This
   change is scoped to the filesystem. The env read is the one remaining
   impurity, left in place: it is trivially stubbable (`vi.stubEnv`) so it does
   not block the test surface, and ADR 0002 deliberately located the CRX-key
   read here.

## Consequences

New: `vite-plugin/src/asset-inventory.ts` and
`vite-plugin/src/__tests__/asset-inventory.test.ts` (the single filesystem
test, which stages a fixture proving both the icon reconcile and the public
partition). Touched: `manifest.ts`, `emit-assets.ts`, `generators/icons.ts`,
`generators/public.ts`, `index.ts` (`generateBundle`), `cli/dev-assets.ts`, and
`internal.ts` (swaps the `collectPublicAssets` export for `discoverAssets` +
`AssetInventory`).

`manifest.test.ts` drops `tmpdir()` and hand-builds an `inventory`. The cases
that were untestable become flat data tests: icons present to `manifest.icons`,
config icons winning over the inventory, Public assets plus a Content surface to
a scoped `web_accessible_resources`, and the same without a Content surface to
none. All filesystem staging for asset tests concentrates in the one
`discoverAssets` test instead of leaking into manifest assertions.

## Considered alternatives

- **Inject an `fs` seam into each module (`detectIcons`, `collectPublicAssets`,
  the emitters).** Rejected: there is only ever one real adapter behind these,
  the disk, so a fake-fs is a hypothetical seam that makes the modules
  shallower, not deeper. `discoverAssets` stays the single real filesystem touch
  and is tested against real directories, which is the correct adapter to test.
- **Preserve the icon double-notion** (the inventory carries both a manifest map
  and a separate raw ship list). Rejected: it keeps two meanings of "icon"
  alive, and the divergence (ship `icons/64.png` but never reference it) is a
  latent bug, not a feature. One set is the canonical one.
- **Hoist `EXTRO_CRX_KEY` too for full purity.** Deferred: the env read barely
  dents the test surface, and pulling it out reopens ADR 0002's placement for
  little gain. Scoped out by choice, not oversight.
- **Full unification with the emit/copy mechanism (Candidate 4).** Deferred: it
  reopens ADR 0004's two-path-but-mirrored decision. Kept separate so this
  change is purely about manifest purity and discovery locality.
