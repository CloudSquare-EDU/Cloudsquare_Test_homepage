// app/page.tsx
// 사용자 시험 목록 — 응시 완료 배지 + duration 0 처리
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { examsApi } from '@/lib/api/exams';
import { ExamWithSubmission } from '@/lib/types';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/Button';
import { formatDuration } from '@/lib/utils';

export default function HomePage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.push('/auth/login'); return; }
    if (user.role === 'ADMIN') { router.push('/admin'); return; }
  }, [user, isInitialized, router]);

  useEffect(() => {
    if (!isInitialized || !user || user.role === 'ADMIN') { setIsLoading(false); return; }

    examsApi.getMy()
      .then((examList) => {
        setExams(examList);
      })
      .catch(() => setError('시험 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  }, [user, isInitialized]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">시험 목록</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {exams.length > 0 ? `${exams.length}개의 시험이 할당되었습니다` : '할당된 시험이 없습니다'}
          </p>
        </div>
        <Link href="/submissions">
          <Button variant="ghost" size="sm">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            내 결과
          </Button>
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-20 text-center">
          <div className="mb-3 text-3xl">📋</div>
          <p className="text-sm text-[var(--text-muted)]">아직 할당된 시험이 없습니다</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">관리자에게 시험 할당을 요청하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exams.map((exam) => {
            const submission = exam.submission;
            const done = !!submission;
            const now = new Date();
            const isNotStarted = !done && !!exam.startDate && new Date(exam.startDate) > now;
            const isExpired = !done && !isNotStarted && !!exam.deadline && new Date(exam.deadline) < now;
            const isUnavailable = isNotStarted || isExpired;

            return (
              <div
                key={exam.id}
                className={`
                  flex items-center gap-4 rounded-lg border px-5 py-4 transition-colors
                  ${done || isUnavailable
                    ? 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-raised)]'
                  }
                `}
              >
                {/* 상태 아이콘 */}
                <div className={`
                  flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm
                  ${done ? 'bg-[var(--success-bg)] text-[var(--success-text)]'
                    : isExpired ? 'bg-[var(--danger-bg)] text-[var(--danger-text)]'
                    : isNotStarted ? 'bg-[rgba(94,106,210,0.1)] text-[#5e6ad2]'
                    : 'bg-[var(--bg-raised)] text-[var(--text-secondary)]'}
                `}>
                  {done ? '✓' : isExpired ? '✕' : isNotStarted ? '🔒' : '📝'}
                </div>

                {/* 시험 정보 */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium break-words ${done || isUnavailable ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                    {exam.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--text-muted)]">
                    <span>{exam.questionCount != null ? `${exam.questionCount}문제` : '문제수 미정'}</span>
                    <span>⏱ {formatDuration(exam.duration)}</span>
                    {exam.startDate && !done && (
                      <span className={isNotStarted ? 'text-[#5e6ad2]' : 'text-[var(--text-faint)]'}>
                        {isNotStarted
                          ? `응시 시작: ${new Date(exam.startDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                          : `시작 ${new Date(exam.startDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}`}
                      </span>
                    )}
                    {exam.deadline && !done && (
                      <span className={isExpired ? 'text-[var(--danger-text)]' : 'text-[var(--warning-text)]'}>
                        {isExpired ? '마감됨' : `마감 ${new Date(exam.deadline).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    )}
                    {done && (
                      <span className="text-[var(--success-text)]">
                        {new Date(submission.submittedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })} 응시완료
                      </span>
                    )}
                  </div>
                </div>

                {/* 점수 배지 or 응시하기 */}
                <div className="flex items-center gap-2 shrink-0">
                  {done ? (
                    <>
                      <span className={`
                        rounded-md px-2.5 py-1 text-sm font-bold
                        ${(submission.score ?? 0) >= 80 ? 'bg-[var(--success-bg)] text-[var(--success-text)]' :
                          (submission.score ?? 0) >= 60 ? 'bg-[var(--warning-bg)] text-[var(--warning-text)]' :
                          'bg-[var(--danger-bg)] text-[var(--danger-text)]'}
                      `}>
                        {submission.score}점
                      </span>
                      <Link href={`/submissions/${submission.id}`}>
                        <Button variant="ghost" size="sm">결과 보기</Button>
                      </Link>
                    </>
                  ) : isExpired ? (
                    <span className="rounded px-2 py-0.5 text-xs bg-[var(--bg-raised)] text-[var(--text-faint)]">기간 만료</span>
                  ) : isNotStarted ? (
                    <span className="rounded px-2 py-0.5 text-xs bg-[rgba(94,106,210,0.1)] text-[#5e6ad2] border border-[rgba(94,106,210,0.2)]">응시 대기 중</span>
                  ) : (
                    <Link href={`/exams/${exam.id}`}>
                      <Button size="sm">응시하기</Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
