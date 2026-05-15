import type { ExtroConfig, ManifestV3 } from "@extrojs/types";
import type { AppTree } from "./app-tree.js";
import { SURFACES, type SurfaceContext } from "./surfaces.js";
import { detectIcons } from "./icons.js";

interface GenerateManifestOptions {
  tree: AppTree;
  root: string;
  pkg: {
    name?: string;
    description?: string;
    version?: string;
  };
  config: ExtroConfig;
  /**
   * When set, the manifest is generated for a dev session:
   *   - CSP relaxed for the Vite dev server + signal WS
   *   - Background descriptor reports present (bridge runs there)
   *   - Background descriptor adds `tabs` to permissions
   */
  dev?: { port: number; signalPort: number };
}

export function generateManifest({
  tree,
  root,
  pkg,
  config,
  dev,
}: GenerateManifestOptions): ManifestV3 {
  const manifest: ManifestV3 = {
    manifest_version: 3,
    name: config.name ?? pkg.name ?? "Extro Extension",
    version: config.version ?? pkg.version ?? "0.0.1",
  };

  const description = config.description ?? pkg.description;
  if (description) {
    manifest.description = description;
  }

  const ctx: SurfaceContext = { tree, config, dev };
  const permissions = new Set<string>(config.permissions ?? []);
  const hostPermissions = new Set<string>(config.hostPermissions ?? []);

  for (const desc of SURFACES) {
    if (!desc.isPresent(ctx)) continue;
    Object.assign(manifest, desc.manifestContribution(ctx));
    if (!config.permissions && desc.permissions) {
      for (const p of desc.permissions(ctx)) permissions.add(p);
    }
    if (!config.hostPermissions && desc.hostPermissions) {
      for (const p of desc.hostPermissions(ctx)) hostPermissions.add(p);
    }
  }

  if (permissions.size > 0) {
    manifest.permissions = [...permissions];
  }
  if (hostPermissions.size > 0) {
    manifest.host_permissions = [...hostPermissions];
  }

  const icons = config.icons ?? detectIcons(root);
  if (icons) {
    manifest.icons = icons;
  }

  if (dev) {
    // CSP relaxed for dev: Vite dev server (HTTP + HMR WS) + the CLI's
    // signal WS that the dev bridge connects to.
    const origin = `http://localhost:${dev.port}`;
    const viteWs = `ws://localhost:${dev.port}`;
    const signalWs = `ws://localhost:${dev.signalPort}`;
    manifest.content_security_policy = {
      extension_pages: [
        `script-src 'self' ${origin} 'wasm-unsafe-eval'`,
        `object-src 'self'`,
        `connect-src 'self' ${origin} ${viteWs} ${signalWs}`,
      ].join("; "),
    };
  }

  if (config.manifest) {
    Object.assign(manifest, config.manifest);
  }

  return manifest;
}
