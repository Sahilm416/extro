// Self-contained so this module needs no @types/chrome to build, and ships no
// ambient global to consumers (the declaration is internal to this file).
declare const chrome: { runtime: { getURL(path: string): string } }

/**
 * Resolve a public asset to its extension URL. Works in every surface (popup,
 * options, sidepanel, background, content), unlike a root-relative `/logo.svg`
 * which resolves against a content script's host-page origin.
 *
 * @example
 * import { asset } from "extrojs/asset"
 * <img src={asset("logo.svg")} />
 */
export const asset = (path: string): string => chrome.runtime.getURL(path)
