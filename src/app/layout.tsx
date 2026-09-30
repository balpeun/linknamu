import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_KR } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans_KR({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-sans',
  preload: false,
});

export const metadata: Metadata = {
  title: '링크나무',
  description: '내 모든 링크를 한 페이지에 모아 하나의 URL로 공유하세요.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

// 첫 화면이 그려지기 전에 저장된 테마(없으면 시스템 설정)를 적용해 깜빡임을 막는다.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={plex.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-stone-100 font-sans text-stone-900 antialiased transition-colors dark:bg-neutral-950 dark:text-stone-100">
        {children}
      </body>
    </html>
  );
}
