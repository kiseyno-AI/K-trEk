import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL ?? 'https://k-scene-nyc.shawn-kang.chatgpt.site',
  ),
  title: 'K-Scene NYC | 뉴욕 한국 공연·행사',
  description:
    '뉴욕과 근교의 한국 아티스트 공연, K-pop 콘서트, 문화 행사를 한눈에 확인하고 바로 예매하세요.',
  icons: {
    icon: '/k-scene-logo.jpg',
    apple: '/k-scene-logo.jpg',
  },
  openGraph: {
    title: 'K-Scene NYC',
    description: '뉴욕의 한국 공연과 이벤트',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'K-Scene NYC',
    description: '뉴욕의 한국 공연과 이벤트',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
