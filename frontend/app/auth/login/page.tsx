// app/auth/login/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await authApi.login(form);
      setAuth(result.user, result.accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f11] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#5e6ad2] text-lg font-bold text-white">
            M
          </div>
          <h1 className="text-lg font-semibold text-[#ededf0]">MockExam</h1>
          <p className="mt-1 text-sm text-[#55556a]">계속하려면 로그인하세요</p>
        </div>

        {/* Form card */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181f] p-6">
          {error && (
            <div className="mb-4 rounded-md border border-[rgba(248,113,113,0.2)] bg-[#250d0d] px-3 py-2.5 text-xs text-[#f87171]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="이메일"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
              required
              autoFocus
            />
            <Input
              label="비밀번호"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="비밀번호 입력"
              required
            />
            <Button type="submit" isLoading={isLoading} className="w-full mt-1">
              로그인
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-[#44445a]">
          계정이 없으신 경우 관리자에게 문의하세요
        </p>
      </div>
    </div>
  );
}
