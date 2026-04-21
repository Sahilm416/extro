export const EXTENSION_ENTRY_POINTS = [
  "popup",
  "background",
  "content",
  "options",
  "sidepanel",
] as const;

export type ExtensionEntry = (typeof EXTENSION_ENTRY_POINTS)[number];

export const HTML_SURFACES = ["popup", "options", "sidepanel"] as const;

export type HtmlSurface = (typeof HTML_SURFACES)[number];

export const ROUTABLE_SURFACES = ["popup", "options", "sidepanel"] as const;

export type RoutableSurface = (typeof ROUTABLE_SURFACES)[number];
