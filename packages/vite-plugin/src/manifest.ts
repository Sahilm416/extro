import type { ExtensionEntry } from "./constants.js";
import type { ManifestV3 } from "./types/index.js";
import { detectIcons } from "./icons.js";

type Entries = Partial<Record<ExtensionEntry, string>>;

interface GenerateManifestOptions {
  entries: Entries;
  root: string;
  name?: string;
  description?: string;
  version?: string;
}

export function generateManifest({
  entries,
  root,
  name = "Extro Extension",
  description,
  version = "0.0.1",
}: GenerateManifestOptions): ManifestV3 {
  const manifest: ManifestV3 = {
    manifest_version: 3,
    name,
    version,
  };

  if (description) {
    manifest.description = description;
  }

  if (entries.popup) {
    manifest.action = {
      default_popup: "popup.html",
    };
  }

  if (entries.background) {
    manifest.background = {
      service_worker: "background.js",
    };

    manifest.permissions = ["storage"];
  }

  if (entries.content) {
    manifest.content_scripts = [
      {
        matches: ["<all_urls>"],
        js: ["content.js"],
      },
    ];

    manifest.host_permissions = ["<all_urls>"];
  }

  if (entries.options) {
    manifest.options_ui = {
      page: "options.html",
      open_in_tab: true,
    };
  }

  if (entries.sidepanel) {
    manifest.side_panel = {
      default_path: "sidepanel.html",
    };
  }

  const icons = detectIcons(root);
  if (icons) {
    manifest.icons = icons;
  }

  return manifest;
}
