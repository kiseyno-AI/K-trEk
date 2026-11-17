import type { Metadata } from 'next';
import { sitePath } from '../lib/site-path';
import './globals.css';

const tripUrl = 'https://shawnai.win/ktravel';
const shareImage = `${tripUrl}/trip/korea-night-map.png`;

export const metadata: Metadata = {
  metadataBase: new URL(tripUrl),
  title: 'K-trEk, without Shawn & Sun',
  description: 'Explore, save and vote on ideas for our Korea trip.',
  alternates: { canonical: tripUrl },
  openGraph: {
    url: tripUrl,
    siteName: 'K-trEk',
    title: 'K-trEk, without Shawn & Sun',
    description: 'Explore, save and vote on ideas for our Korea trip.',
    images: [
      {
        url: shareImage,
        width: 1672,
        height: 941,
        alt: 'Korea at night — K-trEk',
      },
    ],
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'K-trEk, without Shawn & Sun',
    description: 'Explore, save and vote on ideas for our Korea trip.',
    images: [shareImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href={sitePath('/trip/fonts/noto-sans-kr.css')}
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href={sitePath('/trip/fonts/noto-sans-kr-latin.woff2')}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
