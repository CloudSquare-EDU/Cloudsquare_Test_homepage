// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AuthInitializer } from '@/components/domain/auth/AuthInitializer';
import { AppShell } from '@/components/ui/AppShell';

export const metadata: Metadata = {
  title: 'MockExam',
  description: '온라인 모의시험 응시 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthInitializer />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
