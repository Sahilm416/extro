export interface Template {
  /** Directory name under `templates/` and the value accepted by `--template`. */
  name: string
  /** Human label shown in the picker. */
  label: string
  /** One-line summary of which surfaces the template ships. */
  hint: string
}

// One curated, minimal starter. Extro's premise is that surfaces are files you
// drop under src/app/, so the scaffold ships the canonical surface (a popup)
// plus a background worker and lets the convention add the rest, rather than
// pre-generating every surface. The registry stays a list so more starters can
// be added later without reshaping the call sites.
export const TEMPLATES: Template[] = [
  {
    name: "default",
    label: "Default",
    hint: "a popup and a background service worker",
  },
]

export const DEFAULT_TEMPLATE = "default"

export const isTemplate = (name: string): boolean =>
  TEMPLATES.some((template) => template.name === name)
