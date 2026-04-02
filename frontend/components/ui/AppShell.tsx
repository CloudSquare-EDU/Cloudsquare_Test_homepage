// components/ui/AppShell.tsx
// 사이드바 레이아웃 여부를 pathname 기준으로 결정하는 클라이언트 셸
'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

// 이 경로들은 사이드바 없이 전체 화면으로 표시
const BARE_ROUTES = ['/auth/login', '/auth/register'];

// /exams/[id] 경로는 시험 집중 모드 (사이드바 없음)
const isBare = (pathname: string) => {
  if (BARE_ROUTES.includes(pathname)) return true;
  if (/^\/exams\/[^/]+$/.test(pathname)) return true;
  return false;
};

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  if (isBare(pathname)) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
