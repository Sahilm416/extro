import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    // The docs were restructured into Guide + API Reference tabs; keep the
    // original flat URLs working.
    return [
      { source: '/docs', destination: '/docs/guide', permanent: false },
      { source: '/docs/installation', destination: '/docs/guide/quick-start', permanent: true },
      { source: '/docs/project-structure', destination: '/docs/guide/project-structure', permanent: true },
      { source: '/docs/configuration', destination: '/docs/reference/config', permanent: true },
      { source: '/docs/routing', destination: '/docs/guide/routing', permanent: true },
      { source: '/docs/assets', destination: '/docs/guide/assets', permanent: true },
      { source: '/docs/environment', destination: '/docs/guide/environment-variables', permanent: true },
    ];
  },
};

export default withMDX(config);
