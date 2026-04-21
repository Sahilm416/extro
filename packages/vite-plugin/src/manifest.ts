import type { ExtensionEntry } from "./constants.js";
import type { ExtroConfig, ManifestV3 } from "@extro/types";
import { detectIcons } from "./icons.js";

type Entries = Partial<Record<ExtensionEntry, string>>;

interface GenerateManifestOptions {
  entries: Entries;
  root: string;
  pkg: {
    name?: string;
    description?: string;
    version?: string;
  };
  config: ExtroConfig;
}

export function generateManifest({
  entries,
  root,
  pkg,
  config,
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

  if (entries.popup) {
    manifest.action = { default_popup: "popup.html" };
  }

  if (entries.background) {
    manifest.background = { service_worker: "background.js" };
  }

  if (entries.content) {
    manifest.content_scripts = [
      {
        matches: ["<all_urls>"],
        js: ["content.js"],
      },
    ];
  }

  if (entries.options) {
    manifest.options_ui = {
      page: "options.html",
      open_in_tab: true,
    };
  }

  if (entries.sidepanel) {
    manifest.side_panel = { default_path: "sidepanel.html" };
  }

  const permissions = new Set<string>(config.permissions ?? []);
  if (entries.background && !config.permissions) {
    permissions.add("storage");
  }
  if (permissions.size > 0) {
    manifest.permissions = [...permissions];
  }

  const hostPermissions = new Set<string>(config.hostPermissions ?? []);
  if (entries.content && !config.hostPermissions) {
    hostPermissions.add("<all_urls>");
  }
  if (hostPermissions.size > 0) {
    manifest.host_permissions = [...hostPermissions];
  }

  const icons = config.icons ?? detectIcons(root);
  if (icons) {
    manifest.icons = icons;
  }

  if (config.manifest) {
    Object.assign(manifest, config.manifest);
  }

  return manifest;
}
