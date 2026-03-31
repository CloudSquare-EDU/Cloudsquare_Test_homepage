// app/layout.tsx
// 역할: 루트 레이아웃 — 전체 앱에 적용되는 HTML 구조 및 공통 초기화

import type { Metadata } from 'next';
import './globals.css';
import { AuthInitializer } from '@/components/domain/auth/AuthInitializer';
import { Navbar } from '@/components/domain/auth/Navbar';

export const metadata: Metadata = {
  title: '모의시험 플랫폼',
  description: '온라인 모의시험 응시 서비스',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <AuthInitializer />
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
