// components/ui/AppShell.tsx
// 사이드바 레이아웃 여부를 pathname 기준으로 결정하는 클라이언트 셸
// mustChangePassword=true 인 사용자는 /auth/change-password 로 강제 리다이렉트
// 모바일: 상단 헤더 + 햄버거 메뉴로 사이드바 토글
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/lib/store/authStore';

// 이 경로들은 사이드바 없이 전체 화면으로 표시
const BARE_ROUTES = ['/auth/login', '/auth/register', '/auth/change-password'];

// /exams/[id] 경로는 시험 집중 모드 (사이드바 없음)
const isBare = (pathname: string) => {
  if (BARE_ROUTES.includes(pathname)) return true;
  if (/^\/exams\/[^/]+$/.test(pathname)) return true;
  return false;
};

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 페이지 이동 시 모바일 사이드바 자동 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // 첫 로그인 비밀번호 변경 강제 리다이렉트
  useEffect(() => {
    if (!isInitialized) return;
    if (!user) return;
    if (user.mustChangePassword && pathname !== '/auth/change-password') {
      router.replace('/auth/change-password');
    }
  }, [isInitialized, user, pathname, router]);

  if (isBare(pathname)) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* 데스크탑 사이드바 */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* 모바일 사이드바 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 모바일 사이드바 슬라이드 */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 flex transition-transform duration-200 md:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 모바일 상단 헤더 */}
        <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--sidebar-bg)] px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="메뉴 열기"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#5e6ad2] text-[10px] font-bold text-white">
              M
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">모의시험사이트</span>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
