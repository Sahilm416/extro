import type { ExtroConfig, ManifestV3 } from "@extro/types";
import type { AppTree } from "./app-tree.js";
import { SURFACES } from "./surfaces.js";
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
  dev?: { port: number };
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

  const permissions = new Set<string>(config.permissions ?? []);
  const hostPermissions = new Set<string>(config.hostPermissions ?? []);

  // Each surface contributes its own manifest fragment + default permission
  // hints. Order in SURFACES determines key order in the emitted manifest.
  for (const desc of SURFACES) {
    if (!desc.isPresent(tree)) continue;
    Object.assign(manifest, desc.manifestContribution);
    if (!config.permissions && desc.defaultPermissions) {
      for (const p of desc.defaultPermissions) permissions.add(p);
    }
    if (!config.hostPermissions && desc.defaultHostPermissions) {
      for (const p of desc.defaultHostPermissions) hostPermissions.add(p);
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
    // CSP relaxed for dev: allow loading + connecting to the Vite dev server
    // so HMR (which uses WebSocket) and module fetches both work.
    const origin = `http://localhost:${dev.port}`;
    const wsOrigin = `ws://localhost:${dev.port}`;
    manifest.content_security_policy = {
      extension_pages: [
        `script-src 'self' ${origin} 'wasm-unsafe-eval'`,
        `object-src 'self'`,
        `connect-src 'self' ${origin} ${wsOrigin}`,
      ].join("; "),
    };
  }

  if (config.manifest) {
    Object.assign(manifest, config.manifest);
  }

  return manifest;
}
