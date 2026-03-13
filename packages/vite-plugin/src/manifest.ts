import type { ExtensionEntry } from "./constants.js";
import { detectIcons } from "./icons.js";

type Entries = Partial<Record<ExtensionEntry, string>>;

type Manifest = {
  manifest_version: 3;
  name: string;
  version: string;
  action?: {
    default_popup: string;
  };
  background?: {
    service_worker: string;
  };
  content_scripts?: {
    matches: string[];
    js: string[];
  }[];
  host_permissions?: string[];
  permissions?: string[];
  options_ui?: {
    page: string;
    open_in_tab?: boolean;
  };
  side_panel?: {
    default_path: string;
  };
  icons?: Record<string, string>;
};

export function generateManifest(entries: Entries, root: string): Manifest {
  const manifest: Manifest = {
    manifest_version: 3,
    name: "Extro Extension",
    version: "0.0.1",
  };

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
