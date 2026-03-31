// components/domain/auth/Navbar.tsx
// 역할: 상단 네비게이션 바 — 로그인 상태에 따라 메뉴 변경

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
        <Link href="/" className="text-xl font-bold text-blue-600">
          모의시험 플랫폼
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-600">
                안녕하세요, <strong>{user.name}</strong>님
              </span>
              <Link href="/submissions">
                <Button variant="ghost" size="sm">내 결과</Button>
              </Link>
              {user.role === 'ADMIN' && (
                <Link href="/admin/exams">
                  <Button variant="secondary" size="sm">관리자</Button>
                </Link>
              )}
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">로그인</Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm">회원가입</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
