import { ImageResponse } from 'next/og';
import { generate as DefaultImage } from 'fumadocs-ui/og';
import { appName, siteTagline, siteDescription } from '@/lib/shared';

export const revalidate = false;

export function GET() {
  return new ImageResponse(
    <DefaultImage title={siteTagline} description={siteDescription} site={appName} />,
    {
      width: 1200,
      height: 630,
    },
  );
}
