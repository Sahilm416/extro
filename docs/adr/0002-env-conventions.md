# Env conventions for Chrome extensions

## Context

Extro has no environment-variable story. Users have nowhere to put an API base URL, a CRX key, or any value that varies between development and a packaged build.

Two facts make this different from a server framework like Next:

1. **An extension has no server runtime.** Every Surface (popup, options, sidepanel, background, content) is statically built and ships to the user inside the `.crx`, which is a zip they can unpack. The Next-style "public vs private" split assumes a trusted server that holds private values; an extension has no such place. So "private" cannot mean "server-only" here, and the tier model has to be redefined around what an extension actually has: a build step and a set of client bundles.

2. **Extro is a Vite plugin, and Vite already owns the machine.** `loadEnv(mode, root, prefix)` reads `.env` / `.env.[mode]` / `.env.local` with stacking; `envPrefix` controls which vars are exposed; and `import.meta.env.LITERAL_KEY` is statically replaced at transform time with the literal value. That static replacement is what makes env work in the background SW and content scripts, which have no `import.meta` at runtime: by the time the code runs, the access is already a string.

One wrinkle the topology creates: in `extro dev` the routable Surfaces are served by `createServer` in mode `development`, while the Script Surfaces are built by a separate `viteBuild` sidecar in `packages/cli/src/commands/dev.ts` that passes no `mode` and so defaults to `production`. Any "shared env" claim is false until that mismatch is fixed.

## Decision

Build entirely on Vite's native env system, with a two-tier model redefined for an extension's build-plus-client-bundles reality.

1. **Lean on Vite native; no custom dotenv layer.** `loadEnv`, `envPrefix`, and `import.meta.env` replacement are the whole mechanism. Extro adds policy (which prefix, which mode, the CRX map), not a parallel loader.

2. **The axis is dev vs prod, driven by Vite `mode`.** `extro dev` is `development`, `extro build` is `production`. Browser-target env (`.env.chrome`, `.env.firefox`) is explicitly **out of scope**: Extro has one target today (`chrome-mv3`), `mode` already means dev/prod, and Vite will not auto-load a `.env.chrome`. When a multi-browser target system is designed it owns the `.env.[target]` dimension, since that is what would consume it. This ADR names `.env.[target]` as the reserved future home and stops there.

3. **File naming and stacking are Vite's, which are also Next's.** `.env`, `.env.development`, `.env.production`, `.env.local`, `.env.[mode].local`, with precedence `.env` < `.env.[mode]` < `.env.local` < `.env.[mode].local`. `.env.example` is the committed template (already preserved by `.gitignore`) and doubles as the human-readable list of vars until a typed-env feature exists.

4. **Two tiers, redefined for an extension:**

   | Tier | Mechanism | Read by |
   | --- | --- | --- |
   | **Public env var** | `EXTRO_PUBLIC_*`, inlined into every Surface via `import.meta.env` | Surface code |
   | **Build-time env var** | `process.env.*` (all vars), never inlined | `extro.config.ts` and manifest generation |

   `envPrefix` is set to exactly **`EXTRO_PUBLIC_`**, never `EXTRO_`. The longer prefix is load-bearing: `EXTRO_` would match `EXTRO_CRX_KEY` and inline it into Surface bundles. **`EXTRO_*` is a reserved framework namespace** for recognized build-time vars; users put shipping values under `EXTRO_PUBLIC_*` and anything else under a non-`EXTRO_` name.

   "Private" here means "not auto-inlined into a Surface," not "secret." There is no safe place for a real secret in an extension; this is a mechanical boundary, not a security guarantee (see Consequences).

5. **`EXTRO_CRX_KEY` auto-maps to `manifest.key`.** The manifest generator (`packages/vite-plugin/src/manifest.ts`) reads `process.env.EXTRO_CRX_KEY` and writes `manifest.key`, pinning a stable extension ID across machines and reloads. This is the canonical build-time var and the motivating case for the tier. Precedence: the env value is a default; an explicit `config.manifest.key` still wins, since `config.manifest` is `Object.assign`'d last.

6. **One shared env scope across all Surfaces.** A Surface is an output target, not an environment. The mechanism that makes "shared" true is the fix to the sidecar: pass `mode: "development"` to the `viteBuild` sidecar in `dev.ts` so Script Surfaces resolve the same env set as the routables. `envPrefix` is set once in the plugin's `config()` hook, so both the dev server and the sidecar inherit it.

7. **Runtime exposure is raw `import.meta.env.EXTRO_PUBLIC_*`. No helper.** A `extroEnv("KEY")` helper does a dynamic key lookup, which Vite cannot statically replace; it would fall back to a runtime object of all public vars and defeat inline-and-eliminate. Required-var validation (throw on missing) is deferred to a future `defineConfig({ env: { required: [...] } })`.

8. **Type safety: ship a static ambient type, defer codegen.** Extro ships one `.d.ts` augmenting `ImportMetaEnv` with a template-literal index signature typing `EXTRO_PUBLIC_*` as `string | undefined` (honest: a missing var is `undefined` at runtime). Per-var codegen from the declared vars is deferred to a future typed-env feature, paired with the validation in (7).

9. **`process.env` is populated before config load.** Both CLI commands load env via Vite's `loadEnv(mode, root, "")` (empty prefix = all vars, same stacking as `import.meta.env`) and merge into `process.env` before `loadConfig`, without overriding existing real env (dotenv precedence, so CI wins). This makes the build-time tier literally `process.env`, lets `extro.config.ts` read any var, and is the same source the CRX map reads.

10. **Three operational behaviors are document-only in v1:** the secret boundary (mechanical, no scanner), env changes in dev requiring an `extro dev` restart (values are statically inlined; no hot-reload, matching the public-assets decision), and `.env.example` as the committed template.

## Consequences

Touched: `packages/vite-plugin/src/index.ts` (`envPrefix: "EXTRO_PUBLIC_"` in `config()`), `packages/vite-plugin/src/manifest.ts` (`EXTRO_CRX_KEY` to `manifest.key`), `packages/cli/src/commands/dev.ts` (sidecar `mode: "development"`), and both CLI commands plus a shared startup step that populates `process.env` before `loadConfig`. New: a shipped ambient `.d.ts` for `ImportMetaEnv`.

The model is two crisp tiers: `import.meta.env.EXTRO_PUBLIC_*` for values that ship into Surfaces, `process.env.*` for build-time values consumed by config and the manifest. The CRX key is the worked example that makes the build-time tier concrete.

The boundary is mechanical, not a guarantee. Vite refuses to inline a non-prefixed var, but anything a user writes into `manifest.json` (including `manifest.key`) ships in plaintext, and every Surface bundle is readable in the unpacked extension. The docs state plainly that an extension has no server and nothing private should be shipped; Extro does not add a secret-leak heuristic in v1.

Deferred, each with a named future home: browser-target env (`.env.[target]`, the multi-browser ADR), required-var validation and per-var type codegen (a typed-env feature), and `.env` hot-reload in dev.

New domain terms **Public env var** and **Build-time env var** are added to `CONTEXT.md`.

## Considered alternatives

- **An Extro-owned dotenv layer that hides Vite's mechanics.** Rejected. It re-implements `loadEnv`, stacking, and static replacement for no behavioral gain, and the only cited upside (swapping the bundler later) is hypothetical. We accept the coupling; Extro is a Vite plugin.
- **`VITE_*` or `PUBLIC_*` as the prefix.** `VITE_*` leaks the bundler into every user's `.env`, contradicting Extro hiding Vite. `PUBLIC_*` is clean but splits the namespace: `PUBLIC_FOO` for public yet `EXTRO_CRX_KEY` for framework. `EXTRO_PUBLIC_*` keeps one coherent `EXTRO_*` namespace and makes the shipping boundary loud.
- **Per-Surface env scope.** Rejected. No real case (the same value serves popup and SW), and it multiplies machinery. The "separate bundles" instinct was really about mode consistency, which the sidecar fix addresses. Non-breaking to add later if a concrete need appears.
- **A typed `extroEnv()` / `env` helper.** Rejected. Dynamic key lookup defeats static replacement and bundles every public var. Type safety is achievable through `ImportMetaEnv` augmentation at zero runtime cost.
- **Per-var type codegen now (Astro-style).** Rejected for v1. It needs watch, tsconfig wiring, and gitignore plumbing, and pairs naturally with a declared schema we do not have yet. Vite and Next both ship base types and let users hand-augment; we match that and defer the premium feature.
- **`.env.chrome` now, or `.env.dev` / `.env.prod` short names.** `.env.chrome` is a no-op at one target (loads on every build) and is not natively loadable. The short names would require overriding Vite's mode names for less familiarity than `.env.development` / `.env.production`.
