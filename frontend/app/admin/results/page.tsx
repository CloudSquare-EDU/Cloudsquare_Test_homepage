// app/admin/results/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { submissionsApi } from '@/lib/api/submissions';
import { AdminExam, ExamSubmissionStatus, ExamUserStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

const formatDuration = (s: number) => {
  if (s === 0) return '제한 없음';
  if (s < 3600) return `${Math.floor(s / 60)}분`;
  return `${Math.floor(s / 3600)}시간`;
};

const scoreColor = (score: number | null): string => {
  if (score === null) return 'text-[var(--text-muted)]';
  if (score >= 80) return 'text-[var(--success-text)]';
  if (score >= 60) return 'text-[var(--warning-text)]';
  return 'text-[var(--danger-text)]';
};

const scoreBadge = (score: number | null): string => {
  if (score === null) return 'bg-[var(--bg-raised)] text-[var(--text-muted)]';
  if (score >= 80) return 'bg-[var(--success-bg)] text-[var(--success-text)]';
  if (score >= 60) return 'bg-[var(--warning-bg)] text-[var(--warning-text)]';
  return 'bg-[var(--danger-bg)] text-[var(--danger-text)]';
};

export default function AdminResultsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [examStatus, setExamStatus] = useState<Record<string, ExamSubmissionStatus>>({});
  const [loadingExamId, setLoadingExamId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{
    submissionId: string;
    userName: string;
    examTitle: string;
    examId: string;
  } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    examsApi
      .getAllAdmin()
      .then(setExams)
      .catch(() => setError('시험 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  }, []);

  const toggleExam = async (examId: string) => {
    if (expandedExamId === examId) { setExpandedExamId(null); return; }
    setExpandedExamId(examId);
    if (examStatus[examId]) return;
    setLoadingExamId(examId);
    try {
      const data = await submissionsApi.getByExam(examId);
      setExamStatus((prev) => ({ ...prev, [examId]: data }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '응시 현황을 불러오는 데 실패했습니다.');
    } finally {
      setLoadingExamId(null);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      await submissionsApi.reset(resetTarget.submissionId);
      const data = await submissionsApi.getByExam(resetTarget.examId);
      setExamStatus((prev) => ({ ...prev, [resetTarget.examId]: data }));
      setResetTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '재응시 허용 중 오류가 발생했습니다.');
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">응시 결과</h1>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
          시험별 응시 현황 확인 및 재응시 허용
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      )}

      {exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">등록된 시험이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exams.map((exam) => {
            const isExpanded = expandedExamId === exam.id;
            const status = examStatus[exam.id];
            const isLoadingThis = loadingExamId === exam.id;
            const submittedCount = status ? status.users.filter((u) => u.submitted).length : null;
            const totalAssigned = status ? status.users.length : null;

            return (
              <div
                key={exam.id}
                className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--border-hover)]"
              >
                {/* 시험 헤더 */}
                <button
                  onClick={() => toggleExam(exam.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-raised)] text-[#5e6ad2]">
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                      <path d="M10 2v3h3M5 8h6M5 11h4" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">{exam.title}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span>문제 {exam._count?.questions ?? 0}개</span>
                      <span>·</span>
                      <span>{formatDuration(exam.duration)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {submittedCount !== null && totalAssigned !== null ? (
                      <span className="rounded px-2 py-1 text-xs bg-[var(--bg-raised)] text-[var(--text-secondary)]">
                        <span className="text-[var(--text-primary)] font-medium">{submittedCount}</span>
                        <span className="text-[var(--text-faint)]">/{totalAssigned}</span>
                        <span className="ml-1">명 응시</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-faint)]">응시 {exam._count?.submissions ?? 0}회</span>
                    )}
                    <svg
                      className={`h-3.5 w-3.5 text-[var(--text-faint)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                {/* 펼쳐진 사용자 목록 */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-subtle)]">
                    {isLoadingThis ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
                      </div>
                    ) : !status || status.users.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                        할당된 사용자가 없습니다.
                      </p>
                    ) : (
                      <>
                        {/* 요약 바 */}
                        <div className="flex items-center gap-5 border-b border-[var(--border-subtle)] bg-[var(--bg-inset)] px-5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            <span className="text-xs text-[var(--text-muted)]">
                              완료 <span className="text-[var(--text-primary)]">{status.users.filter((u) => u.submitted).length}</span>명
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--bg-raised)]" />
                            <span className="text-xs text-[var(--text-muted)]">
                              미응시 <span className="text-[var(--text-secondary)]">{status.users.filter((u) => !u.submitted).length}</span>명
                            </span>
                          </div>
                          {status.users.filter((u) => u.submitted).length > 0 && (
                            <div className="ml-auto text-xs text-[var(--text-muted)]">
                              평균{' '}
                              <span className="font-semibold text-[var(--text-primary)]">
                                {Math.round(
                                  status.users
                                    .filter((u) => u.submitted && u.submission?.score !== null)
                                    .reduce((sum, u) => sum + (u.submission?.score ?? 0), 0) /
                                    status.users.filter((u) => u.submitted).length,
                                )}
                              </span>
                              점
                            </div>
                          )}
                        </div>

                        {/* 사용자별 행 */}
                        <div className="divide-y divide-[var(--border-subtle)]">
                          {status.users.map((userStatus: ExamUserStatus) => (
                            <div
                              key={userStatus.userId}
                              className="flex items-center justify-between px-5 py-3.5"
                            >
                              {/* 사용자 */}
                              <div className="flex items-center gap-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-raised)] text-xs font-semibold text-[#5e6ad2]">
                                  {userStatus.userName.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[var(--text-primary)]">{userStatus.userName}</p>
                                  <p className="text-xs text-[var(--text-faint)]">{userStatus.userEmail}</p>
                                </div>
                              </div>

                              {/* 결과 영역 */}
                              <div className="flex items-center gap-3">
                                {userStatus.submitted && userStatus.submission ? (
                                  <>
                                    {/* 점수 뱃지 */}
                                    <span className={`rounded px-2 py-0.5 text-sm font-bold ${scoreBadge(userStatus.submission.score)}`}>
                                      {userStatus.submission.score}점
                                    </span>

                                    {/* 정답 수 */}
                                    <span className="text-xs text-[var(--text-faint)]">
                                      {Math.round(((userStatus.submission.score ?? 0) / 100) * userStatus.submission.totalQuestions)}
                                      /{userStatus.submission.totalQuestions}
                                    </span>

                                    {/* 응시일 */}
                                    <span className={`text-xs ${scoreColor(null)} text-[var(--text-faint)] text-right min-w-[60px]`}>
                                      {new Date(userStatus.submission.submittedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                      {' '}
                                      {new Date(userStatus.submission.submittedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>

                                    <Link href={`/submissions/${userStatus.submission.id}`}>
                                      <Button variant="secondary" size="sm">결과 보기</Button>
                                    </Link>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setResetTarget({
                                          submissionId: userStatus.submission!.id,
                                          userName: userStatus.userName,
                                          examTitle: exam.title,
                                          examId: exam.id,
                                        })
                                      }
                                    >
                                      재응시
                                    </Button>
                                  </>
                                ) : (
                                  <span className="rounded px-2 py-0.5 text-xs bg-[var(--bg-raised)] text-[var(--text-faint)]">
                                    미응시
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!resetTarget}
        title="재응시를 허용하시겠습니까?"
        message={
          resetTarget
            ? `[${resetTarget.examTitle}] 시험에서 ${resetTarget.userName}의 응시 기록이 삭제되어 재응시가 가능해집니다.`
            : ''
        }
        confirmLabel="재응시 허용"
        onConfirm={handleReset}
        onCancel={() => setResetTarget(null)}
        isLoading={isResetting}
      />
    </div>
  );
}
