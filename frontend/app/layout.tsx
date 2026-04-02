// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AuthInitializer } from '@/components/domain/auth/AuthInitializer';
import { AppShell } from '@/components/ui/AppShell';
import { ThemeProvider } from '@/components/ui/ThemeProvider';

export const metadata: Metadata = {
  title: '모의시험사이트',
  description: '온라인 모의시험 응시 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <ThemeProvider>
          <AuthInitializer />
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
