// app/admin/results/page.tsx
// 역할: 관리자 응시 결과 관리 페이지
// 구조: 시험 목록 → 클릭하면 해당 시험에 할당된 사용자별 응시 현황 펼쳐보기
// 기능:
//   1. 전체 시험 목록 표시 — 응시 완료 수 / 전체 할당 수 요약
//   2. 시험 클릭 시 사용자별 점수, 응시일, 미응시 여부 표시
//   3. 재응시 허용 버튼 — submission 삭제로 재응시 가능하게 처리
//   4. 결과 상세 링크

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { submissionsApi } from '@/lib/api/submissions';
import { AdminExam, ExamSubmissionStatus, ExamUserStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

export default function AdminResultsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [examStatus, setExamStatus] = useState<Record<string, ExamSubmissionStatus>>({});
  const [loadingExamId, setLoadingExamId] = useState<string | null>(null);

  // 재응시 허용 확인 모달
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
    if (expandedExamId === examId) {
      setExpandedExamId(null);
      return;
    }
    setExpandedExamId(examId);
    if (examStatus[examId]) return; // 캐시 있으면 재요청 안 함

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
      // 캐시 갱신
      const data = await submissionsApi.getByExam(resetTarget.examId);
      setExamStatus((prev) => ({ ...prev, [resetTarget.examId]: data }));
      setResetTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '재응시 허용 중 오류가 발생했습니다.');
    } finally {
      setIsResetting(false);
    }
  };

  // 점수 색상
  const scoreColor = (score: number | null) => {
    if (score === null) return '';
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">응시 결과 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          시험별로 할당된 사용자의 응시 현황을 확인하고 재응시를 허용할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {exams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
          등록된 시험이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exams.map((exam) => {
            const isExpanded = expandedExamId === exam.id;
            const status = examStatus[exam.id];
            const isLoadingThis = loadingExamId === exam.id;

            // 응시 완료 수 계산 (캐시 있을 때만)
            const submittedCount = status
              ? status.users.filter((u) => u.submitted).length
              : null;
            const totalAssigned = status ? status.users.length : exam._count?.submissions;

            return (
              <div
                key={exam.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* 시험 헤더 — 클릭으로 펼치기 */}
                <button
                  onClick={() => toggleExam(exam.id)}
                  className="flex w-full items-center justify-between p-5 text-left transition hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-lg">
                      📝
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{exam.title}</p>
                      <p className="text-sm text-gray-500">
                        {exam.duration > 0 ? `${Math.floor(exam.duration / 60)}분` : '제한 없음'}
                        {' · '}문제 {exam._count?.questions ?? 0}개
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {submittedCount !== null ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 font-medium">
                        {submittedCount} / {totalAssigned}명 응시
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">
                        응시 {exam._count?.submissions ?? 0}회
                      </span>
                    )}
                    <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* 펼쳐진 사용자 목록 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {isLoadingThis ? (
                      <p className="py-6 text-center text-sm text-gray-500">로딩 중...</p>
                    ) : !status || status.users.length === 0 ? (
                      <p className="py-6 text-center text-sm text-gray-500">
                        할당된 사용자가 없습니다.
                      </p>
                    ) : (
                      <>
                        {/* 응시 현황 요약 바 */}
                        <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                            <span className="text-xs text-gray-600">
                              응시 완료 {status.users.filter((u) => u.submitted).length}명
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                            <span className="text-xs text-gray-600">
                              미응시 {status.users.filter((u) => !u.submitted).length}명
                            </span>
                          </div>
                          {status.users.filter((u) => u.submitted).length > 0 && (
                            <div className="ml-auto text-xs text-gray-500">
                              평균 점수:{' '}
                              <strong className="text-gray-800">
                                {Math.round(
                                  status.users
                                    .filter((u) => u.submitted && u.submission?.score !== null)
                                    .reduce((sum, u) => sum + (u.submission?.score ?? 0), 0) /
                                    status.users.filter((u) => u.submitted).length,
                                )}
                                점
                              </strong>
                            </div>
                          )}
                        </div>

                        {/* 사용자별 행 */}
                        <div className="divide-y divide-gray-100">
                          {status.users.map((userStatus: ExamUserStatus) => (
                            <div
                              key={userStatus.userId}
                              className="flex items-center justify-between px-5 py-4"
                            >
                              {/* 사용자 정보 */}
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                                  {userStatus.userName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800">{userStatus.userName}</p>
                                  <p className="text-xs text-gray-400">{userStatus.userEmail}</p>
                                </div>
                              </div>

                              {/* 응시 결과 영역 */}
                              <div className="flex items-center gap-3">
                                {userStatus.submitted && userStatus.submission ? (
                                  <>
                                    {/* 점수 */}
                                    <div className="text-right">
                                      <span
                                        className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${scoreColor(userStatus.submission.score)}`}
                                      >
                                        {userStatus.submission.score}점
                                      </span>
                                      <p className="mt-0.5 text-xs text-gray-400">
                                        {userStatus.submission.totalQuestions}문제 중{' '}
                                        {Math.round(
                                          ((userStatus.submission.score ?? 0) / 100) *
                                            userStatus.submission.totalQuestions,
                                        )}
                                        개 정답
                                      </p>
                                    </div>

                                    {/* 응시일 */}
                                    <div className="text-right text-xs text-gray-400 min-w-[70px]">
                                      {new Date(userStatus.submission.submittedAt).toLocaleDateString('ko-KR')}
                                      <br />
                                      {new Date(userStatus.submission.submittedAt).toLocaleTimeString('ko-KR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>

                                    {/* 결과 상세 보기 */}
                                    <Link href={`/submissions/${userStatus.submission.id}`}>
                                      <Button variant="secondary" size="sm">
                                        결과 보기
                                      </Button>
                                    </Link>

                                    {/* 재응시 허용 */}
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
                                      🔄 재응시
                                    </Button>
                                  </>
                                ) : (
                                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-400">
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

      {/* 재응시 허용 확인 모달 */}
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
