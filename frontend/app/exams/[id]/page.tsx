// app/exams/[id]/page.tsx
// 역할: 시험 응시 페이지
// UX 요구사항: 타이머 고정 표시, beforeunload 이탈 방지, 제출 전 확인 모달
// 변경 이력:
//   - isPublished 조건 제거, 중복 응시 차단 UI 추가
//   - 선다형 지원: answerCount > 1이면 체크박스, 1이면 라디오 방식 표시
//   - answers 상태: Record<string, string[]> (선택지 ID 배열)

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { submissionsApi } from '@/lib/api/submissions';
import { ExamDetail, SubmissionSummary } from '@/lib/types';
import { useTimer } from '@/lib/hooks/useTimer';
import { Timer } from '@/components/ui/Timer';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  // answers: questionId → 선택된 choiceId 배열 (단답형도 배열로 통일)
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<SubmissionSummary | null>(null);

  // 타이머 만료 시 자동 제출
  const handleTimerExpire = useCallback(() => {
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { formattedTime, isWarning } = useTimer({
    initialSeconds: exam?.duration ?? 0,
    onExpire: handleTimerExpire,
  });

  // 시험 데이터 로드 + 중복 응시 여부 확인
  useEffect(() => {
    const load = async () => {
      try {
        const [examData, prevSub] = await Promise.all([
          examsApi.getById(id),
          submissionsApi.checkExamSubmission(id),
        ]);
        setExam(examData);
        if (prevSub) setExistingSubmission(prevSub);
      } catch {
        setError('시험을 불러오는 데 실패했습니다. 로그인 후 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
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

  // 단답형 선택 (radio 방식 — 하나만 선택)
  const handleSingleSelect = (questionId: string, choiceId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: [choiceId] }));
  };

  // 선다형 토글 (checkbox 방식 — 복수 선택)
  const handleMultiToggle = (questionId: string, choiceId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const exists = current.includes(choiceId);
      const updated = exists
        ? current.filter((id) => id !== choiceId)
        : [...current, choiceId];
      return { ...prev, [questionId]: updated };
    });
  };

  const handleSubmit = async () => {
    if (!exam) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    const answerList = exam.questions.map((q) => ({
      questionId: q.id,
      choiceIds: answers[q.id] ?? [],
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

  // 답한 문제 수: choiceIds 배열이 비어있지 않은 문제만 카운트
  const answeredCount = exam
    ? exam.questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length
    : 0;
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

  // 이미 응시한 경우 — 재응시 불가 안내 화면
  if (existingSubmission) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-8 max-w-md w-full">
          <p className="text-4xl mb-4">📋</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">이미 응시한 시험입니다</h2>
          <p className="text-gray-600 mb-1">
            <strong>{exam.title}</strong>
          </p>
          <p className="text-gray-500 text-sm mb-2">
            응시일: {new Date(existingSubmission.submittedAt).toLocaleDateString('ko-KR')}
          </p>
          <p className="text-2xl font-bold text-blue-600 mb-6">
            점수: {existingSubmission.score}점
          </p>
          <div className="flex flex-col gap-2">
            <Link href={`/submissions/${existingSubmission.id}`}>
              <Button className="w-full">결과 상세 보기</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary" className="w-full">시험 목록으로</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            재응시가 필요하면 관리자에게 문의하세요.
          </p>
        </div>
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
        {exam.questions.map((question, idx) => {
          const isMulti = question.answerCount > 1;
          const selectedIds = answers[question.id] ?? [];

          return (
            <div
              key={question.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              {/* 문제 텍스트 + 선다형 배지 */}
              <div className="mb-1 flex items-start gap-2">
                <p className="flex-1 font-medium text-gray-900">
                  <span className="mr-2 text-blue-600">Q{idx + 1}.</span>
                  {question.content}
                </p>
                {isMulti && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    복수 정답 ({question.answerCount}개)
                  </span>
                )}
              </div>
              {isMulti && (
                <p className="mb-3 text-xs text-gray-400 pl-6">
                  정답을 모두 선택하세요. (총 {question.answerCount}개)
                </p>
              )}

              <div className="flex flex-col gap-2 mt-3">
                {question.choices.map((choice) => {
                  const isSelected = selectedIds.includes(choice.id);

                  if (isMulti) {
                    // ── 선다형: 체크박스 ──
                    return (
                      <label
                        key={choice.id}
                        className={`
                          flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition
                          ${isSelected
                            ? 'border-purple-500 bg-purple-50 text-purple-800'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleMultiToggle(question.id, choice.id)}
                          className="h-4 w-4 rounded text-purple-600"
                        />
                        <span
                          className={`
                            flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold
                            ${isSelected ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-400'}
                          `}
                        >
                          {choice.order}
                        </span>
                        {choice.content}
                      </label>
                    );
                  }

                  // ── 단답형: 라디오 방식 버튼 ──
                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleSingleSelect(question.id, choice.id)}
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
                          flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold
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
          );
        })}
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
