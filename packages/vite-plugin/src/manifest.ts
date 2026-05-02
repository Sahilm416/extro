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
  /**
   * When set, the manifest is generated for a dev session:
   *   - CSP relaxed for the Vite dev server + signal WS
   *   - A background service worker is forced (the dev bridge runs there)
   *   - `tabs` permission added so the bridge can call chrome.tabs.reload
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

  const permissions = new Set<string>(config.permissions ?? []);
  const hostPermissions = new Set<string>(config.hostPermissions ?? []);

  // In dev, treat the tree as if it always has a background — the dev
  // bridge is bundled into background.js even if the user didn't write one.
  const effectiveTree: AppTree = dev
    ? {
        ...tree,
        scripts: {
          ...tree.scripts,
          background: tree.scripts.background ?? "<dev-bridge>",
        },
      }
    : tree;

  for (const desc of SURFACES) {
    if (!desc.isPresent(effectiveTree)) continue;
    Object.assign(manifest, desc.manifestContribution);
    if (!config.permissions && desc.defaultPermissions) {
      for (const p of desc.defaultPermissions) permissions.add(p);
    }
    if (!config.hostPermissions && desc.defaultHostPermissions) {
      for (const p of desc.defaultHostPermissions) hostPermissions.add(p);
    }
  }

  if (dev && !config.permissions) {
    // Bridge needs `tabs` to reload CS-hosting tabs after a rebuild.
    permissions.add("tabs");
  }

  if (permissions.size > 0) {
    manifest.permissions = [...permissions];
  }
  if (hostPermissions.size > 0) {
    manifest.host_permissions = [...hostPermissions];
  }

  if (tree.csui) {
    // The CSUI mount runtime dynamic-imports content.js (with cache-bust)
    // to swap in new code on rebuild without reloading the host page.
    // chrome.runtime.getURL works only for resources declared accessible.
    manifest.web_accessible_resources = [
      ...(manifest.web_accessible_resources ?? []),
      { resources: ["content.js"], matches: ["<all_urls>"] },
    ];
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
