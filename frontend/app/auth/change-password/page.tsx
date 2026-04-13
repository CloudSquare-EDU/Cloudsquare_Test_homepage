// app/auth/change-password/page.tsx
// 역할: 첫 로그인 후 비밀번호 강제 변경 페이지
// 설계 이유: mustChangePassword=true 인 사용자는 이 페이지에서 비밀번호를 변경해야
//           다른 페이지에 접근할 수 있다.
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { usersApi } from '@/lib/api/users';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/Button';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      await usersApi.changeMyPassword(currentPassword, newPassword);
      // 스토어의 mustChangePassword 플래그 해제
      updateUser({ mustChangePassword: false });
      // 역할에 따라 이동
      if (user?.role === 'ADMIN') {
        router.replace('/admin');
      } else {
        router.replace('/');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4">
      <div className="w-full max-w-sm">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(94,106,210,0.12)]">
            <svg className="h-6 w-6 text-[#5e6ad2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">비밀번호 변경 필요</h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            관리자가 설정한 초기 비밀번호를 변경해 주세요.
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              현재 비밀번호
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="현재 비밀번호 입력"
              className="
                w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]
                px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]
                focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[rgba(94,106,210,0.2)]
              "
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              새 비밀번호
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="8자 이상"
              className="
                w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]
                px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]
                focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[rgba(94,106,210,0.2)]
              "
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="새 비밀번호 재입력"
              className="
                w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]
                px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]
                focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[rgba(94,106,210,0.2)]
              "
            />
          </div>

          {error && (
            <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="mt-1 w-full"
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
          >
            {isLoading ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--text-faint)]">
          비밀번호 변경 후 자동으로 이동합니다
        </p>
      </div>
    </div>
  );
}
