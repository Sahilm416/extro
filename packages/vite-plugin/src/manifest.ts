import type { ExtensionEntry } from "./constants.js";

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
};

export function generateManifest(entries: Entries): Manifest {
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

  return manifest;
}
