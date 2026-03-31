// app/exams/[id]/page.tsx
// 역할: 시험 응시 페이지
// UX 요구사항: 타이머 고정 표시, beforeunload 이탈 방지, 제출 전 확인 모달

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { examsApi } from '@/lib/api/exams';
import { submissionsApi } from '@/lib/api/submissions';
import { ExamDetail, AnswerInput } from '@/lib/types';
import { useTimer } from '@/lib/hooks/useTimer';
import { Timer } from '@/components/ui/Timer';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 타이머 만료 시 자동 제출
  const handleTimerExpire = useCallback(() => {
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { formattedTime, isWarning } = useTimer({
    initialSeconds: exam?.duration ?? 0,
    onExpire: handleTimerExpire,
  });

  // 시험 데이터 로드
  useEffect(() => {
    examsApi
      .getById(id)
      .then(setExam)
      .catch(() => setError('시험을 불러오는 데 실패했습니다. 로그인 후 다시 시도해주세요.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  // 페이지 이탈 방지 (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '시험이 진행 중입니다. 정말 나가시겠습니까?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleAnswerSelect = (questionId: string, choiceId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  };

  const handleSubmit = async () => {
    if (!exam) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    const answerList: AnswerInput[] = exam.questions.map((q) => ({
      questionId: q.id,
      choiceId: answers[q.id] ?? '',
    }));

    try {
      const result = await submissionsApi.submit({
        examId: exam.id,
        answers: answerList,
      });
      router.push(`/submissions/${result.submissionId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('제출 중 오류가 발생했습니다.');
      }
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const totalCount = exam?.questions.length ?? 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">시험 로딩 중...</p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        {error ?? '시험을 찾을 수 없습니다.'}
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* 상단 고정 헤더 — 타이머 항상 표시 */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4">
          <div>
            <h1 className="font-semibold text-gray-900">{exam.title}</h1>
            <p className="text-sm text-gray-500">
              {answeredCount} / {totalCount} 문제 응답
            </p>
          </div>
          {exam.duration > 0 && <Timer formattedTime={formattedTime} isWarning={isWarning} />}
        </div>
      </div>

      {/* 문제 목록 */}
      <div className="mt-6 flex flex-col gap-6">
        {exam.questions.map((question, idx) => (
          <div
            key={question.id}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="mb-4 font-medium text-gray-900">
              <span className="mr-2 text-blue-600">Q{idx + 1}.</span>
              {question.content}
            </p>
            <div className="flex flex-col gap-2">
              {question.choices.map((choice) => {
                const isSelected = answers[question.id] === choice.id;
                return (
                  <button
                    key={choice.id}
                    onClick={() => handleAnswerSelect(question.id, choice.id)}
                    className={`
                      flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span
                      className={`
                        flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold
                        ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-400'}
                      `}
                    >
                      {choice.order}
                    </span>
                    {choice.content}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 하단 고정 제출 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-4 shadow-lg">
        <div className="mx-auto flex max-w-5xl justify-end">
          {error && <p className="mr-4 self-center text-sm text-red-600">{error}</p>}
          <Button
            onClick={() => setShowConfirmModal(true)}
            isLoading={isSubmitting}
            size="lg"
          >
            제출하기 ({answeredCount}/{totalCount})
          </Button>
        </div>
      </div>

      {/* 제출 확인 모달 */}
      <Modal
        isOpen={showConfirmModal}
        title="시험을 제출하시겠습니까?"
        message={
          answeredCount < totalCount
            ? `아직 ${totalCount - answeredCount}개 문제에 답하지 않았습니다. 그래도 제출하시겠습니까?`
            : '모든 문제에 답했습니다. 제출 후에는 수정할 수 없습니다.'
        }
        confirmLabel="제출"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirmModal(false)}
        isLoading={isSubmitting}
        variant={answeredCount < totalCount ? 'danger' : 'default'}
      />
    </div>
  );
}
