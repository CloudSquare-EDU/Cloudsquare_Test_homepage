// app/submissions/page.tsx
// 역할: 내 응시 기록 목록 페이지

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { submissionsApi } from '@/lib/api/submissions';
import { SubmissionSummary } from '@/lib/types';
import { Button } from '@/components/ui/Button';

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    submissionsApi
      .getMy()
      .then(setSubmissions)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">응시 기록 로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">내 응시 기록</h1>

      {submissions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
          <p className="mb-4">아직 응시한 시험이 없습니다.</p>
          <Link href="/">
            <Button variant="ghost">시험 목록으로</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div>
                <h2 className="font-semibold text-gray-900">{s.exam.title}</h2>
                <p className="text-sm text-gray-500">
                  {new Date(s.submittedAt).toLocaleString('ko-KR')}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-blue-600">
                  {s.score ?? '-'} / 100점
                </span>
                <Link href={`/submissions/${s.id}`}>
                  <Button variant="secondary" size="sm">결과 보기</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
