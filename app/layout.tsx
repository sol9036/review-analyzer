import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '하루살림 | 무선 청소기 리뷰 분석 & 소비자원 안전 데이터 대시보드',
  description: 'AI 기반 리뷰 전수 분석 및 한국소비자원 안전사고 교차 검증 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
