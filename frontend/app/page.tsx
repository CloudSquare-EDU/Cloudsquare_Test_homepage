// app/page.tsx
// 사용자 시험 목록 — 응시 완료 배지 + duration 0 처리
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { examsApi } from '@/lib/api/exams';
import { submissionsApi } from '@/lib/api/submissions';
import { ExamSummary, SubmissionSummary } from '@/lib/types';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/Button';

const formatDuration = (seconds: number) => {
  if (seconds === 0) return '제한 없음';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
};

export default function HomePage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [submissionMap, setSubmissionMap] = useState<Record<string, SubmissionSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.push('/auth/login'); return; }
    if (user.role === 'ADMIN') { router.push('/admin'); return; }
  }, [user, isInitialized, router]);

  useEffect(() => {
    if (!isInitialized || !user || user.role === 'ADMIN') { setIsLoading(false); return; }

    Promise.all([examsApi.getAll(), submissionsApi.getMy()])
      .then(([examList, submissions]) => {
        setExams(examList);
        const map: Record<string, SubmissionSummary> = {};
        submissions.forEach((s) => { map[s.exam.id] = s; });
        setSubmissionMap(map);
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
      <div className="rounded-md border border-[rgba(248,113,113,0.2)] bg-[#250d0d] p-3 text-sm text-[#f87171]">
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#ededf0]">시험 목록</h1>
          <p className="mt-0.5 text-sm text-[#55556a]">
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] py-20 text-center">
          <div className="mb-3 text-3xl">📋</div>
          <p className="text-sm text-[#55556a]">아직 할당된 시험이 없습니다</p>
          <p className="mt-1 text-xs text-[#44445a]">관리자에게 시험 할당을 요청하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exams.map((exam) => {
            const submission = submissionMap[exam.id];
            const done = !!submission;

            return (
              <div
                key={exam.id}
                className={`
                  flex items-center gap-4 rounded-lg border px-5 py-4 transition-colors
                  ${done
                    ? 'border-[rgba(255,255,255,0.06)] bg-[#18181f]'
                    : 'border-[rgba(255,255,255,0.08)] bg-[#18181f] hover:border-[rgba(255,255,255,0.14)] hover:bg-[#1e1e28]'
                  }
                `}
              >
                {/* 상태 아이콘 */}
                <div className={`
                  flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm
                  ${done ? 'bg-[#0f2318] text-green-400' : 'bg-[#1e1e28] text-[#9090aa]'}
                `}>
                  {done ? '✓' : '📝'}
                </div>

                {/* 시험 정보 */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${done ? 'text-[#9090aa]' : 'text-[#ededf0]'}`}>
                    {exam.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-[#55556a]">
                    <span>{exam.questionCount}문제</span>
                    <span>⏱ {formatDuration(exam.duration)}</span>
                    {done && (
                      <span className="text-green-500">
                        {new Date(submission.submittedAt).toLocaleDateString('ko-KR')} 응시
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
                        ${(submission.score ?? 0) >= 80 ? 'bg-[#0f2318] text-green-400' :
                          (submission.score ?? 0) >= 60 ? 'bg-[#211800] text-yellow-400' :
                          'bg-[#250d0d] text-red-400'}
                      `}>
                        {submission.score}점
                      </span>
                      <Link href={`/submissions/${submission.id}`}>
                        <Button variant="ghost" size="sm">결과 보기</Button>
                      </Link>
                    </>
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
