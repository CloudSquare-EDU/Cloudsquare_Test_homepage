// app/submissions/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { submissionsApi } from '@/lib/api/submissions';
import { SubmissionSummary } from '@/lib/types';
import { Button } from '@/components/ui/Button';

const scoreColor = (score: number | null) => {
  if (score === null) return 'text-[#55556a]';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

const scoreBg = (score: number | null) => {
  if (score === null) return 'bg-[#1e1e28]';
  if (score >= 80) return 'bg-[#0f2318]';
  if (score >= 60) return 'bg-[#211800]';
  return 'bg-[#250d0d]';
};

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    submissionsApi.getMy().then(setSubmissions).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#ededf0]">내 응시 기록</h1>
          <p className="mt-0.5 text-sm text-[#55556a]">
            {submissions.length > 0 ? `총 ${submissions.length}회 응시` : '응시 기록이 없습니다'}
          </p>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm">시험 목록</Button>
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] py-20 text-center">
          <div className="mb-3 text-3xl">📊</div>
          <p className="text-sm text-[#55556a]">아직 응시한 시험이 없습니다</p>
          <Link href="/" className="mt-4">
            <Button size="sm">시험 목록으로</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#18181f] px-5 py-4 hover:border-[rgba(255,255,255,0.14)] hover:bg-[#1e1e28] transition-colors"
            >
              {/* 점수 */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${scoreBg(s.score)} ${scoreColor(s.score)}`}>
                {s.score ?? '-'}
              </div>

              {/* 시험 정보 */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#ededf0] truncate">{s.exam.title}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-[#55556a]">
                  <span>{s.totalQuestions}문제</span>
                  <span>·</span>
                  <span>{new Date(s.submittedAt).toLocaleString('ko-KR', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}</span>
                </div>
              </div>

              <Link href={`/submissions/${s.id}`}>
                <Button variant="ghost" size="sm">결과 보기</Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
