// app/admin/results/page.tsx
// 역할: 관리자 응시 결과 관리 페이지
// 기능:
//   1. 전체 사용자 목록 표시 — 각 사용자별 할당된 시험 + 응시 여부 + 점수
//   2. 사용자 클릭 시 해당 사용자의 시험별 현황 펼쳐보기
//   3. 재응시 허용 버튼 — submission 삭제로 재응시 가능하게 처리
//   4. 결과 상세 링크

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usersApi, UserSummary } from '@/lib/api/users';
import { submissionsApi } from '@/lib/api/submissions';
import { UserSubmissionStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

export default function AdminResultsPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<Record<string, UserSubmissionStatus>>({});
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  // 재응시 허용 확인 모달
  const [resetTarget, setResetTarget] = useState<{
    submissionId: string;
    userName: string;
    examTitle: string;
    userId: string;
  } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .getAll()
      .then((all) => setUsers(all.filter((u) => u.role === 'USER')))
      .catch(() => setError('사용자 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  }, []);

  const toggleUser = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (userStatus[userId]) return; // 캐시 있으면 재요청 안 함

    setLoadingUserId(userId);
    try {
      const data = await submissionsApi.getByUser(userId);
      setUserStatus((prev) => ({ ...prev, [userId]: data }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '응시 현황을 불러오는 데 실패했습니다.');
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      await submissionsApi.reset(resetTarget.submissionId);
      // 캐시 갱신: 해당 사용자 데이터 새로 불러오기
      const data = await submissionsApi.getByUser(resetTarget.userId);
      setUserStatus((prev) => ({ ...prev, [resetTarget.userId]: data }));
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
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">응시 결과 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          사용자별 시험 응시 현황을 확인하고 재응시를 허용할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
          등록된 일반 사용자가 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => {
            const isExpanded = expandedUserId === user.id;
            const status = userStatus[user.id];
            const isLoadingThis = loadingUserId === user.id;

            return (
              <div
                key={user.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* 사용자 헤더 — 클릭으로 펼치기 */}
                <button
                  onClick={() => toggleUser(user.id)}
                  className="flex w-full items-center justify-between p-5 text-left transition hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      할당 {user._count.userExams}개 · 응시 {user._count.submissions}회
                    </span>
                    <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* 펼쳐진 시험 목록 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {isLoadingThis ? (
                      <p className="py-6 text-center text-sm text-gray-500">로딩 중...</p>
                    ) : !status || status.exams.length === 0 ? (
                      <p className="py-6 text-center text-sm text-gray-500">
                        할당된 시험이 없습니다.
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {status.exams.map((exam) => (
                          <div
                            key={exam.examId}
                            className="flex items-center justify-between px-5 py-4"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{exam.examTitle}</p>
                              <p className="text-xs text-gray-500">
                                제한 시간 {Math.floor(exam.duration / 60)}분
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {exam.submitted && exam.submission ? (
                                <>
                                  {/* 점수 뱃지 */}
                                  <div className="text-right">
                                    <span
                                      className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${
                                        (exam.submission.score ?? 0) >= 80
                                          ? 'bg-green-100 text-green-700'
                                          : (exam.submission.score ?? 0) >= 60
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-red-100 text-red-700'
                                      }`}
                                    >
                                      {exam.submission.score}점
                                    </span>
                                    <p className="mt-0.5 text-xs text-gray-400">
                                      {new Date(exam.submission.submittedAt).toLocaleDateString('ko-KR')}
                                    </p>
                                  </div>

                                  {/* 결과 상세 보기 */}
                                  <Link href={`/submissions/${exam.submission.id}`}>
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
                                        submissionId: exam.submission!.id,
                                        userName: user.name,
                                        examTitle: exam.examTitle,
                                        userId: user.id,
                                      })
                                    }
                                  >
                                    🔄 재응시 허용
                                  </Button>
                                </>
                              ) : (
                                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
                                  미응시
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
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
            ? `${resetTarget.userName}의 [${resetTarget.examTitle}] 응시 기록이 삭제되어 재응시가 가능해집니다.`
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
