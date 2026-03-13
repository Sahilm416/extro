export const EXTENSION_ENTRY_POINTS = [
  "popup",
  "background",
  "content",
  "options",
  "sidepanel",
] as const;

export type ExtensionEntry = (typeof EXTENSION_ENTRY_POINTS)[number];
