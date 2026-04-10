// app/admin/results/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { submissionsApi } from '@/lib/api/submissions';
import { AdminExam, ExamSubmissionStatus, ExamUserStatus, AssignedQuestion } from '@/lib/types';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';
import { formatDuration, scoreColor } from '@/lib/utils';

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

  // 필터/정렬
  type FilterMode = 'all' | 'submitted' | 'not_submitted';
  type SortMode = 'name' | 'score_desc' | 'score_asc' | 'date_desc';
  const [filterMode, setFilterMode] = useState<Record<string, FilterMode>>({});
  const [sortMode, setSortMode] = useState<Record<string, SortMode>>({});

  const getFilteredSorted = (examId: string, users: ExamUserStatus[]) => {
    const filter = filterMode[examId] ?? 'all';
    const sort = sortMode[examId] ?? 'name';
    let result = [...users];
    if (filter === 'submitted') result = result.filter((u) => u.submitted);
    if (filter === 'not_submitted') result = result.filter((u) => !u.submitted);
    result.sort((a, b) => {
      if (sort === 'name') return a.userName.localeCompare(b.userName, 'ko', { numeric: true });
      if (sort === 'score_desc') return (b.submission?.score ?? -1) - (a.submission?.score ?? -1);
      if (sort === 'score_asc') return (a.submission?.score ?? 101) - (b.submission?.score ?? 101);
      if (sort === 'date_desc') {
        const da = a.submission ? new Date(a.submission.submittedAt).getTime() : 0;
        const db = b.submission ? new Date(b.submission.submittedAt).getTime() : 0;
        return db - da;
      }
      return 0;
    });
    return result;
  };

  // 배정 문제 모달
  const [assignmentModal, setAssignmentModal] = useState<{
    examId: string;
    userName: string;
    questions: AssignedQuestion[] | null;
    isLoading: boolean;
  } | null>(null);

  const openAssignment = async (examId: string, userId: string, userName: string) => {
    setAssignmentModal({ examId, userName, questions: null, isLoading: true });
    try {
      const questions = await submissionsApi.getUserAssignment(examId, userId);
      setAssignmentModal({ examId, userName, questions, isLoading: false });
    } catch {
      setAssignmentModal({ examId, userName, questions: [], isLoading: false });
    }
  };

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

  const exportToExcel = (examTitle: string, status: ExamSubmissionStatus) => {
    const rows = status.users.map((u) => ({
      이름: u.userName,
      이메일: u.userEmail,
      응시여부: u.submitted ? '응시' : '미응시',
      점수: u.submitted && u.submission?.score !== null ? u.submission?.score : '',
      정답수: u.submitted && u.submission
        ? Math.round(((u.submission.score ?? 0) / 100) * u.submission.totalQuestions)
        : '',
      총문항: u.submitted && u.submission ? u.submission.totalQuestions : '',
      응시일시: u.submitted && u.submission
        ? new Date(u.submission.submittedAt).toLocaleString('ko-KR')
        : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 24 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '응시결과');
    XLSX.writeFile(wb, `${examTitle}_응시결과.xlsx`);
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
                            <div className="text-xs text-[var(--text-muted)]">
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
                          <button
                            onClick={() => exportToExcel(exam.title, status)}
                            className="ml-auto flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M8 2v8M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" strokeLinecap="round" />
                            </svg>
                            엑셀 저장
                          </button>
                        </div>

                        {/* 필터/정렬 바 */}
                        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-2">
                          <div className="flex gap-1">
                            {(['all', 'submitted', 'not_submitted'] as const).map((f) => (
                              <button
                                key={f}
                                onClick={() => setFilterMode((prev) => ({ ...prev, [exam.id]: f }))}
                                className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                                  (filterMode[exam.id] ?? 'all') === f
                                    ? 'bg-[#5e6ad2] text-white'
                                    : 'bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {f === 'all' ? '전체' : f === 'submitted' ? '응시' : '미응시'}
                              </button>
                            ))}
                          </div>
                          <select
                            value={sortMode[exam.id] ?? 'name'}
                            onChange={(e) => setSortMode((prev) => ({ ...prev, [exam.id]: e.target.value as SortMode }))}
                            className="ml-auto h-6 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 text-[11px] text-[var(--text-secondary)] focus:outline-none"
                          >
                            <option value="name">이름순</option>
                            <option value="score_desc">점수 높은순</option>
                            <option value="score_asc">점수 낮은순</option>
                            <option value="date_desc">최근 응시순</option>
                          </select>
                        </div>

                        {/* 사용자별 행 */}
                        <div className="divide-y divide-[var(--border-subtle)]">
                          {getFilteredSorted(exam.id, status.users).map((userStatus: ExamUserStatus) => (
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

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openAssignment(exam.id, userStatus.userId, userStatus.userName)}
                                    >
                                      문제 목록
                                    </Button>

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
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openAssignment(exam.id, userStatus.userId, userStatus.userName)}
                                    >
                                      문제 목록
                                    </Button>
                                    <span className="rounded px-2 py-0.5 text-xs bg-[var(--bg-raised)] text-[var(--text-faint)]">
                                      미응시
                                    </span>
                                  </div>
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

      {/* 배정 문제 목록 모달 */}
      {assignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setAssignmentModal(null)}
          />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  배정 문제 목록
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {assignmentModal.userName}
                </p>
              </div>
              <button
                onClick={() => setAssignmentModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-faint)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 본문 */}
            <div className="overflow-y-auto">
              {assignmentModal.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
                </div>
              ) : !assignmentModal.questions || assignmentModal.questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-[var(--text-muted)]">배정된 문제가 없습니다.</p>
                  <p className="mt-1 text-xs text-[var(--text-faint)]">시험 응시 시 문제가 자동으로 배정됩니다.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {assignmentModal.questions.map((q) => (
                    <div key={q.id} className="px-5 py-4">
                      {/* 문제 */}
                      <div className="flex gap-3">
                        <span className="mt-0.5 shrink-0 text-xs font-semibold text-[#5e6ad2]">
                          Q{q.order}
                        </span>
                        <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                          {q.content}
                        </p>
                      </div>
                      {/* 선택지 */}
                      <div className="mt-2.5 flex flex-col gap-1.5 pl-6">
                        {q.choices.map((choice) => (
                          <div
                            key={choice.id}
                            className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs ${
                              choice.isCorrect
                                ? 'bg-[var(--success-bg)] text-[var(--success-text)]'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {choice.isCorrect ? (
                              <svg className="mt-0.5 h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M3 8l4 4 6-7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-current opacity-30" />
                            )}
                            <span>{choice.content}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 */}
            {assignmentModal.questions && assignmentModal.questions.length > 0 && (
              <div className="border-t border-[var(--border-subtle)] px-5 py-3">
                <p className="text-xs text-[var(--text-faint)]">
                  총 <span className="font-medium text-[var(--text-secondary)]">{assignmentModal.questions.length}</span>문제 배정됨
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
