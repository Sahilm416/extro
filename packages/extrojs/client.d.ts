// Ambient types for Extro's env, for code that imports nothing else from the
// framework (a bare background or content script). Opt in once:
//   /// <reference types="extrojs/client" />
// The single source of the env shape is src/react/env.ts (ADR 0002); this
// re-surfaces that one declaration for the explicit-reference path, so the two
// opt-in routes never declare ImportMetaEnv twice. EXTRO_PUBLIC_* is inlined
// into every surface via import.meta.env.
/// <reference path="./dist/react/env.d.ts" />
