// app/submissions/[id]/page.tsx
// 역할: 응시 결과 상세 페이지 — 점수, 정오표 표시

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { submissionsApi } from '@/lib/api/submissions';
import { SubmissionDetail } from '@/lib/types';
import { Button } from '@/components/ui/Button';

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    submissionsApi
      .getById(id)
      .then(setSubmission)
      .catch(() => setError('결과를 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">결과 로딩 중...</p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        {error ?? '결과를 찾을 수 없습니다.'}
      </div>
    );
  }

  const correctCount = submission.answers.filter((a) => a.isCorrect).length;
  const percentage = submission.score ?? Math.round((correctCount / submission.totalQuestions) * 100);

  return (
    <div>
      {/* 결과 요약 카드 */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-white shadow-lg">
        <h1 className="mb-1 text-xl font-semibold">{submission.exam.title}</h1>
        <p className="mb-6 text-blue-200 text-sm">
          {new Date(submission.submittedAt).toLocaleString('ko-KR')} 제출
        </p>
        <div className="flex items-end gap-2">
          <span className="text-6xl font-black">{percentage}</span>
          <span className="mb-2 text-2xl font-semibold">점</span>
        </div>
        <p className="mt-2 text-blue-200">
          {correctCount}문제 정답 / 총 {submission.totalQuestions}문제
        </p>
      </div>

      {/* 정오표 */}
      <h2 className="mb-4 text-lg font-bold">문제별 결과</h2>
      <div className="flex flex-col gap-4">
        {submission.answers.map((answer, idx) => (
          <div
            key={answer.questionId}
            className={`rounded-xl border p-5 ${
              answer.isCorrect
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="mb-3 flex items-start gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  answer.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                }`}
              >
                {answer.isCorrect ? '정답' : '오답'}
              </span>
              <p className="font-medium text-gray-900">
                Q{idx + 1}. {answer.question.content}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 pl-4">
              {answer.question.choices.map((choice) => {
                const isMyAnswer = choice.id === answer.choice.id;
                const isCorrectAnswer = choice.isCorrect;

                return (
                  <p
                    key={choice.id}
                    className={`text-sm ${
                      isCorrectAnswer
                        ? 'font-semibold text-green-700'
                        : isMyAnswer && !isCorrectAnswer
                        ? 'text-red-600 line-through'
                        : 'text-gray-600'
                    }`}
                  >
                    {choice.order}. {choice.content}
                    {isCorrectAnswer && ' ✓'}
                    {isMyAnswer && !isCorrectAnswer && ' (내 답)'}
                  </p>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Link href="/">
          <Button variant="secondary">시험 목록으로</Button>
        </Link>
        <Link href="/submissions">
          <Button>내 기록 보기</Button>
        </Link>
      </div>
    </div>
  );
}
