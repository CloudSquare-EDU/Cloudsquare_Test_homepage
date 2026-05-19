// app/exams/[id]/page.tsx
// 시험 응시 페이지 — 전체화면 집중 모드
// 상태: intro → in-progress → (redirect to result)
// localStorage로 답안 자동 저장/복원
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { submissionsApi } from '@/lib/api/submissions';
import { ExamDetail, SubmissionSummary } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { useTimer } from '@/lib/hooks/useTimer';
import { Timer } from '@/components/ui/Timer';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

type ExamPhase = 'loading' | 'already-done' | 'intro' | 'in-progress' | 'error';

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const DRAFT_KEY = `exam_draft_${id}`;

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [phase, setPhase] = useState<ExamPhase>('loading');
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [existingSubmission, setExistingSubmission] = useState<SubmissionSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 타이머는 in-progress 상태일 때만 동작
  const isTimerActive = phase === 'in-progress';

  const handleTimerExpire = useCallback(() => {
    if (phase === 'in-progress') handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const { formattedTime, isWarning } = useTimer({
    initialSeconds: exam?.duration ?? 0,
    onExpire: handleTimerExpire,
    paused: !isTimerActive,
  });

  // 데이터 로드
  useEffect(() => {
    const load = async () => {
      try {
        const [examData, prevSub] = await Promise.all([
          examsApi.getById(id),
          submissionsApi.checkExamById(id),  // 전체 목록 대신 단건 조회
        ]);
        setExam(examData);
        if (prevSub) {
          setExistingSubmission(prevSub);
          setPhase('already-done');
        } else {
          // localStorage에서 임시 저장된 답안 복원
          const saved = localStorage.getItem(DRAFT_KEY);
          if (saved) {
            try { setAnswers(JSON.parse(saved)); } catch { /* ignore */ }
          }
          setPhase('intro');
        }
      } catch {
        setPhase('error');
      }
    };
    load();
  }, [id]);

  // 답안 자동 저장 — 500ms debounce (매 keypress마다 localStorage 동기 write 방지)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase !== 'in-progress') return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [answers, phase]);

  // 시험 시작 시 페이지 이탈 방지
  useEffect(() => {
    if (phase !== 'in-progress') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '시험이 진행 중입니다. 정말 나가시겠습니까?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const handleSingleSelect = (questionId: string, choiceId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: [choiceId] }));
  };

  const handleMultiToggle = (questionId: string, choiceId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const updated = current.includes(choiceId)
        ? current.filter((cid) => cid !== choiceId)
        : [...current, choiceId];
      return { ...prev, [questionId]: updated };
    });
  };

  const handleSubmit = async () => {
    if (!exam) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);
    // 미응답 문제 제외 — 빈 choiceIds는 백엔드 검증 실패 유발
    const answerList = exam.questions
      .filter((q) => (answers[q.id]?.length ?? 0) > 0)
      .map((q) => ({ questionId: q.id, choiceIds: answers[q.id]! }));
    try {
      const result = await submissionsApi.submit({ examId: exam.id, answers: answerList });
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/submissions/${result.submissionId}`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : '제출 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  const answeredCount = exam
    ? exam.questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length
    : 0;
  const totalCount = exam?.questions.length ?? 0;

  // ── Loading ──
  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  // ── Error ──
  if (phase === 'error' || !exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
        <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
          시험을 불러오는 데 실패했습니다.{' '}
          <Link href="/" className="underline">돌아가기</Link>
        </div>
      </div>
    );
  }

  // ── Already done ──
  if (phase === 'already-done' && existingSubmission) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
        <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-bg)] text-2xl">
            ✓
          </div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">이미 응시한 시험입니다</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{exam.title}</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            {new Date(existingSubmission.submittedAt).toLocaleDateString('ko-KR')} 응시
          </p>
          <p className="mt-4 text-3xl font-black text-[var(--success-text)]">{existingSubmission.score}<span className="text-base font-normal text-[var(--text-muted)]">점</span></p>
          <div className="mt-5 flex flex-col gap-2">
            <Link href={`/submissions/${existingSubmission.id}`}>
              <Button className="w-full">결과 상세 보기</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="w-full">시험 목록으로</Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-[var(--text-faint)]">재응시는 관리자에게 문의하세요</p>
        </div>
      </div>
    );
  }

  // ── Intro ──
  if (phase === 'intro') {
    const hasDraft = Object.keys(answers).length > 0;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
        <div className="w-full max-w-md">
          {/* 헤더 */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-raised)] text-2xl">
              📝
            </div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{exam.title}</h1>
            {exam.description && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{exam.description}</p>
            )}
          </div>

          {/* 시험 정보 */}
          <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)]">
              <div className="px-5 py-4 text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{totalCount}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">문제 수</p>
              </div>
              <div className="px-5 py-4 text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{formatDuration(exam.duration)}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">제한 시간</p>
              </div>
            </div>
          </div>

          {/* 임시저장 안내 */}
          {hasDraft && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-[rgba(94,106,210,0.3)] bg-[#1e2245] px-3 py-2.5 text-xs text-[#8090d8]">
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 1a5 5 0 110 10A5 5 0 018 3zm-.5 2.5v4l3 1.5.5-.87-2.5-1.26V5.5h-1z" />
              </svg>
              이전에 작성 중이던 답안이 있습니다. 이어서 시작합니다.
            </div>
          )}

          {/* 주의사항 */}
          <div className="mb-5 text-xs text-[var(--text-faint)] space-y-1">
            <p>• 시험 중 페이지를 나가면 답안이 임시 저장됩니다</p>
            <p>• 제출 후에는 수정이 불가합니다</p>
            {exam.duration > 0 && <p>• 시간 초과 시 자동 제출됩니다</p>}
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => setPhase('in-progress')}
          >
            시험 시작
          </Button>
          <Link href="/">
            <Button variant="ghost" className="mt-2 w-full" size="sm">취소</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── In Progress ──
  return (
    <div className="min-h-screen bg-[var(--bg)] pb-28 sm:pb-24">
      {/* 상단 고정 헤더 */}
      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--sidebar-bg)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3">
          {/* 제목 + 응답 수 */}
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-sm font-semibold text-[var(--text-primary)]">{exam.title}</h1>
            <p className="text-xs text-[var(--text-muted)]">{answeredCount} / {totalCount} 응답</p>
          </div>
          {/* 타이머 */}
          {exam.duration > 0 && <Timer formattedTime={formattedTime} isWarning={isWarning} />}
          {/* 진행률 바 (sm 이상) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="h-1.5 w-20 rounded-full bg-[var(--bg-raised)]">
              <div
                className="h-full rounded-full bg-[#5e6ad2] transition-all"
                style={{ width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-[var(--text-muted)]">{totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0}%</span>
          </div>
        </div>
        {/* 모바일 진행률 바 (전체 폭) */}
        <div className="h-0.5 bg-[var(--bg-raised)] sm:hidden">
          <div
            className="h-full bg-[#5e6ad2] transition-all"
            style={{ width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 문제 목록 */}
      <div className="mx-auto max-w-3xl px-3 pt-4 flex flex-col gap-3 sm:px-5 sm:pt-6 sm:gap-4">
        {exam.questions.map((question, idx) => {
          const isMulti = question.answerCount > 1;
          const selectedIds = answers[question.id] ?? [];

          return (
            <div
              key={question.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5"
            >
              <div className="mb-3 flex items-start gap-2">
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-[var(--bg-raised)] text-[#5e6ad2]">
                  Q{idx + 1}
                </span>
                {isMulti && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[var(--bg-raised)] text-[#8090d8]">
                    복수 정답 {question.answerCount}개
                  </span>
                )}
                <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                  {question.content}
                </p>
              </div>

              <div className="flex flex-col gap-2 mt-3">
                {question.choices.map((choice) => {
                  const isSelected = selectedIds.includes(choice.id);

                  if (isMulti) {
                    return (
                      <label
                        key={choice.id}
                        className={`
                          flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors sm:px-4
                          ${isSelected
                            ? 'border-[#5e6ad2] bg-[rgba(94,106,210,0.1)] text-[var(--text-primary)]'
                            : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleMultiToggle(question.id, choice.id)}
                          className="h-4 w-4 shrink-0 rounded accent-[#5e6ad2]"
                        />
                        <span className={`shrink-0 text-xs font-mono ${isSelected ? 'text-[#5e6ad2]' : 'text-[var(--text-faint)]'}`}>
                          {choice.order}.
                        </span>
                        <span className="leading-snug">{choice.content}</span>
                      </label>
                    );
                  }

                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleSingleSelect(question.id, choice.id)}
                      className={`
                        flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors sm:px-4
                        ${isSelected
                          ? 'border-[#5e6ad2] bg-[rgba(94,106,210,0.1)] text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                        }
                      `}
                    >
                      <span className={`
                        flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-mono
                        ${isSelected ? 'border-[#5e6ad2] bg-[#5e6ad2] text-white' : 'border-[var(--border-hover)] text-[var(--text-faint)]'}
                      `}>
                        {choice.order}
                      </span>
                      <span className="leading-snug">{choice.content}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 고정 제출 바 */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-[var(--sidebar-bg)]/90 backdrop-blur-sm px-4 py-3 sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {errorMsg ? (
            <p className="text-xs text-[var(--danger-text)]">{errorMsg}</p>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              {answeredCount < totalCount
                ? `${totalCount - answeredCount}개 문제를 아직 풀지 않았습니다`
                : '모든 문제에 답했습니다 ✓ 제출 가능합니다'}
            </p>
          )}
          <Button
            onClick={() => setShowConfirmModal(true)}
            disabled={answeredCount < totalCount}
            isLoading={isSubmitting}
            className="w-full sm:w-auto"
          >
            제출하기 ({answeredCount}/{totalCount})
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showConfirmModal}
        title="시험을 제출하시겠습니까?"
        message="제출 후에는 수정이 불가합니다."
        confirmLabel="제출"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirmModal(false)}
        isLoading={isSubmitting}
      />
    </div>
  );
}
