import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Geist } from 'next/font/google';
import { appName, siteUrl, siteTagline, siteDescription } from '@/lib/shared';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const title = `${appName}: ${siteTagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s - ${appName}`,
  },
  description: siteDescription,
  applicationName: appName,
  openGraph: {
    type: 'website',
    siteName: appName,
    url: '/',
    title,
    description: siteDescription,
    images: ['/og'],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: siteDescription,
    images: ['/og'],
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geist.className}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
