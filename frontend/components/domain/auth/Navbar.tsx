// components/domain/auth/Navbar.tsx
// 역할: 상단 네비게이션 바
// ADMIN: "관리자 페이지" 버튼 표시
// USER: 시험 목록, 내 결과만 표시

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/Button';

export const Navbar = () => {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    clearAuth();
    router.push('/auth/login');
  };

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* 로고 — ADMIN은 /admin으로, USER는 /로 이동 */}
        <Link
          href={user?.role === 'ADMIN' ? '/admin' : '/'}
          className="text-xl font-bold text-blue-600"
        >
          모의시험 플랫폼
          {user?.role === 'ADMIN' && (
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              관리자
            </span>
          )}
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-gray-600 sm:block">
                {user.name}
              </span>

              {user.role === 'ADMIN' ? (
                // 관리자 전용 메뉴
                <Link href="/admin">
                  <Button size="sm" variant="primary">
                    🛠 관리자 페이지
                  </Button>
                </Link>
              ) : (
                // 일반 사용자 메뉴
                <>
                  <Link href="/">
                    <Button variant="ghost" size="sm">시험 목록</Button>
                  </Link>
                  <Link href="/submissions">
                    <Button variant="ghost" size="sm">내 결과</Button>
                  </Link>
                </>
              )}

              <Button variant="secondary" size="sm" onClick={handleLogout}>
                로그아웃
              </Button>
            </>
          ) : (
            // 비로그인 상태
            <Link href="/auth/login">
              <Button size="sm">로그인</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};
