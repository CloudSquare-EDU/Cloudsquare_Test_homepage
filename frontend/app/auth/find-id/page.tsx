// app/auth/find-id/page.tsx
// 역할: ID 찾기 (로그인 전 공개 페이지)
// 이름 + 학번을 입력하면, 관리자가 등록해 둔
//   1) 모의시험 사이트 ID(이메일)
//   2) 네이버클라우드(NCP) 실습 계정 ID
// 를 과정별로 보여준다. 비밀번호는 보안상 표시하지 않고, 슬랙으로 관리자에게 문의하도록 안내한다.
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { authApi, FoundAccount } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api/client';

export default function FindIdPage() {
  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<FoundAccount[] | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setAccounts(null);
    setIsLoading(true);
    try {
      const res = await authApi.findAccount({ name: name.trim(), studentNumber: studentNumber.trim() });
      setAccounts(res.accounts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#5e6ad2] text-lg font-bold text-white">
            M
          </div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">ID 찾기</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            이름과 학번을 입력하면 배부된 계정 ID를 확인할 수 있습니다
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5 text-xs text-[var(--danger-text)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              required
              autoFocus
            />
            <Input
              label="학번"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="학번 입력"
              required
            />
            <Button type="submit" isLoading={isLoading} className="mt-1 w-full">
              ID 조회
            </Button>
          </form>
        </div>

        {/* 조회 결과 */}
        {accounts !== null && (
          <div className="mt-5">
            {accounts.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 text-center text-sm text-[var(--text-muted)]">
                일치하는 정보가 없습니다.
                <br />
                이름과 학번을 다시 확인하시거나 관리자에게 문의해 주세요.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-[var(--text-muted)]">
                  총 {accounts.length}개 과정의 계정이 조회되었습니다.
                </p>
                {accounts.map((a, idx) => (
                  <div
                    key={`${a.email}-${idx}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
                  >
                    <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
                      {a.courseName ?? '과정 미배정'}
                    </p>
                    <dl className="flex flex-col gap-2.5 text-sm">
                      <div>
                        <dt className="text-xs text-[var(--text-faint)]">모의시험 사이트 ID</dt>
                        <dd className="mt-0.5 select-all font-medium text-[var(--text-secondary)]">{a.email}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--text-faint)]">네이버클라우드 실습 계정 ID</dt>
                        <dd className="mt-0.5 select-all font-medium text-[var(--text-secondary)]">
                          {a.ncpAccountId ?? <span className="font-normal text-[var(--text-faint)]">등록된 정보가 없습니다</span>}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}

                <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5 text-xs leading-relaxed text-[var(--warning-text)]">
                  비밀번호는 보안상 이곳에서 확인할 수 없습니다. 비밀번호가 필요하시면 슬랙으로 관리자에게 문의해 주세요.
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-xs text-[var(--text-faint)]">
          <Link href="/auth/login" className="font-medium text-[#5e6ad2] hover:underline">
            ← 로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
