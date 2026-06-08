export const appName = 'Extro';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const siteTagline = 'Next.js for Chrome extensions';
export const siteDescription =
  'File-based entrypoints, automatic Manifest V3, and type-safe routing for Chrome extensions, driven by a single Vite plugin.';

/**
 * Canonical origin for absolute URLs (metadataBase, OG/Twitter images). No
 * hardcoded domain: Vercel's production alias is used by default, and a custom
 * domain can override via NEXT_PUBLIC_SITE_URL. Falls back to localhost in dev.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const gitConfig = {
  user: 'Sahilm416',
  repo: 'extro',
  branch: 'main',
};
