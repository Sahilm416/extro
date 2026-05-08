import type { ExtroConfig, ManifestV3 } from "@extro/types";
import type { AppTree } from "./app-tree.js";
import type { RoutableSurface } from "./surfaces.js";
import { generateManifest } from "./manifest.js";
import { generateHTML } from "./generators/html.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Receives one finished asset at a time. Sync (Vite's `emitFile`) and async
 * (`fs.writeFile`) sinks both fit — callers that await the seam will see
 * any rejection from the async path.
 */
export type EmitSink = (fileName: string, source: string) => void | Promise<void>;

export interface AssetOptions {
  tree: AppTree;
  root: string;
  pkg: {
    name?: string;
    description?: string;
    version?: string;
  };
  config: ExtroConfig;
  dev?: { port: number; signalPort: number };
}

export interface Artifacts {
  manifest: ManifestV3;
  html: Partial<Record<RoutableSurface, string>>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure projection from inputs to artifact strings. Exposed alongside
 * `emitAssets` so tests can assert "given this tree, this is the manifest"
 * without a sink.
 */
export function composeArtifacts(opts: AssetOptions): Artifacts {
  const manifest = generateManifest(opts);

  const html: Partial<Record<RoutableSurface, string>> = {};
  for (const surface of Object.keys(opts.tree.surfaces) as RoutableSurface[]) {
    html[surface] = generateHTML({
      surface,
      dev: opts.dev ? { port: opts.dev.port } : undefined,
    });
  }

  return { manifest, html };
}

/**
 * Canonical emission of Extro's static outputs (manifest + per-surface HTML).
 * Both the build (`generateBundle`) and dev (`writeDevAssets`) call paths go
 * through here — the only difference between them is the sink.
 *
 * Icons live outside this seam: they are emitted once during build via
 * Rollup's binary-asset path and are not needed in dev (the initial
 * `viteBuild` already wrote them to disk).
 */
export async function emitAssets(
  opts: AssetOptions,
  emit: EmitSink,
): Promise<void> {
  const { manifest, html } = composeArtifacts(opts);

  await emit("manifest.json", JSON.stringify(manifest, null, 2));

  for (const [surface, body] of Object.entries(html)) {
    if (!body) continue;
    await emit(`${surface}.html`, body);
  }
}
