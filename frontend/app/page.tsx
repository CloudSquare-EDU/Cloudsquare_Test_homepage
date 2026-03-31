// app/page.tsx
// 역할: 메인 페이지 — 공개된 시험 목록 표시

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { examsApi } from '@/lib/api/exams';
import { ExamSummary } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';

export default function HomePage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ADMIN은 관리자 대시보드로 자동 이동
  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.push('/auth/login'); return; }
    if (user.role === 'ADMIN') { router.push('/admin'); return; }
  }, [user, isInitialized, router]);

  useEffect(() => {
    if (!user || user.role === 'ADMIN') return;
    examsApi
      .getAll()
      .then(setExams)
      .catch(() => setError('시험 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">시험 목록 로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        <p>{error}</p>
        <Link href="/auth/login" className="mt-2 inline-block text-sm underline">
          로그인 후 다시 시도해주세요
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">시험 목록</h1>

      {exams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
          <p>현재 응시 가능한 시험이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <h2 className="mb-1 text-lg font-semibold text-gray-900">{exam.title}</h2>
              {exam.description && (
                <p className="mb-3 text-sm text-gray-500 line-clamp-2">{exam.description}</p>
              )}
              <div className="mb-4 flex gap-4 text-sm text-gray-600">
                <span>📝 {exam.questionCount}문제</span>
                <span>⏱ {Math.floor(exam.duration / 60)}분</span>
              </div>
              <Link href={`/exams/${exam.id}`}>
                <Button size="sm" className="w-full">
                  응시하기
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
