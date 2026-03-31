// app/admin/users/page.tsx
// 역할: 관리자 사용자 관리 페이지
// 기능:
// 1. 전체 사용자 목록 조회
// 2. 사용자 계정 직접 생성 (이름, 이메일, 비밀번호, role 지정)
// 3. role 변경 (USER ↔ ADMIN)
// 4. 사용자별 시험 할당 관리 (모달에서 처리)
// 5. 사용자 삭제

'use client';

import { useEffect, useState, FormEvent } from 'react';
import { usersApi, UserSummary, AssignedUser } from '@/lib/api/users';
import { examsApi } from '@/lib/api/exams';
import { AdminExam } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 사용자 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', role: 'USER' as 'USER' | 'ADMIN',
  });
  const [isCreating, setIsCreating] = useState(false);

  // 삭제 확인
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 시험 할당 모달
  const [assignTarget, setAssignTarget] = useState<UserSummary | null>(null);
  const [allExams, setAllExams] = useState<AdminExam[]>([]);
  const [assignedExamIds, setAssignedExamIds] = useState<Set<string>>(new Set());
  const [isLoadingExams, setIsLoadingExams] = useState(false);

  const loadUsers = () => {
    setIsLoading(true);
    usersApi.getAll()
      .then(setUsers)
      .catch(() => setError('사용자 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  // 사용자 생성
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      await usersApi.create(createForm);
      setShowCreateForm(false);
      setCreateForm({ name: '', email: '', password: '', role: 'USER' });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // role 변경
  const handleRoleChange = async (userId: string, currentRole: 'USER' | 'ADMIN') => {
    const newRole = currentRole === 'USER' ? 'ADMIN' : 'USER';
    try {
      await usersApi.updateRole(userId, newRole);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'role 변경 중 오류가 발생했습니다.');
    }
  };

  // 사용자 삭제
  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await usersApi.delete(deleteTargetId);
      setDeleteTargetId(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 시험 할당 모달 열기
  const openAssignModal = async (user: UserSummary) => {
    setAssignTarget(user);
    setIsLoadingExams(true);
    try {
      const [exams, assigned] = await Promise.all([
        examsApi.getAllAdmin(),
        usersApi.getByExam('').catch(() => [] as AssignedUser[]),
      ]);
      setAllExams(exams);
      // 이 사용자에게 할당된 시험 ID 계산
      const assignedIds = new Set<string>();
      for (const exam of exams) {
        try {
          const assignedUsers = await usersApi.getByExam(exam.id);
          if (assignedUsers.some((u) => u.id === user.id)) {
            assignedIds.add(exam.id);
          }
        } catch { /* 무시 */ }
      }
      setAssignedExamIds(assignedIds);
    } finally {
      setIsLoadingExams(false);
    }
  };

  // 시험 할당 토글
  const handleToggleExam = async (examId: string) => {
    if (!assignTarget) return;
    try {
      if (assignedExamIds.has(examId)) {
        await usersApi.removeFromExam(examId, assignTarget.id);
        setAssignedExamIds((prev) => { const s = new Set(prev); s.delete(examId); return s; });
      } else {
        await usersApi.assignToExam(examId, assignTarget.id);
        setAssignedExamIds((prev) => new Set([...prev, examId]));
      }
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '시험 할당 중 오류가 발생했습니다.');
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <Button onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? '취소' : '+ 계정 생성'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* 계정 생성 폼 */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5"
        >
          <h2 className="mb-4 font-semibold">새 계정 생성</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="이름"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="홍길동"
              required
            />
            <Input
              label="이메일"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="user@example.com"
              required
            />
            <Input
              label="비밀번호"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="8자 이상"
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">권한</label>
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm({ ...createForm, role: e.target.value as 'USER' | 'ADMIN' })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USER">일반 사용자</option>
                <option value="ADMIN">관리자</option>
              </select>
            </div>
            <Button type="submit" isLoading={isCreating}>생성</Button>
          </div>
        </form>
      )}

      {/* 사용자 목록 */}
      <div className="flex flex-col gap-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.role === 'ADMIN' ? '관리자' : '일반'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="mt-1 text-xs text-gray-400">
                  응시 {user._count.submissions}회 · 할당된 시험 {user._count.userExams}개
                </p>
              </div>

              <div className="flex gap-2">
                {/* 시험 할당 */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openAssignModal(user)}
                >
                  시험 할당
                </Button>
                {/* role 변경 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRoleChange(user.id, user.role)}
                >
                  {user.role === 'USER' ? '관리자로' : '일반으로'}
                </Button>
                {/* 삭제 */}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTargetId(user.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTargetId}
        title="사용자를 삭제하시겠습니까?"
        message="삭제된 사용자와 모든 응시 기록은 복구할 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
        isLoading={isDeleting}
      />

      {/* 시험 할당 모달 */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setAssignTarget(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold">시험 할당</h2>
            <p className="mb-4 text-sm text-gray-500">
              <strong>{assignTarget.name}</strong>에게 접근 허용할 시험을 선택하세요.
            </p>

            {isLoadingExams ? (
              <p className="py-4 text-center text-sm text-gray-500">시험 목록 로딩 중...</p>
            ) : allExams.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">등록된 시험이 없습니다.</p>
            ) : (
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                {allExams.map((exam) => {
                  const isAssigned = assignedExamIds.has(exam.id);
                  return (
                    <button
                      key={exam.id}
                      onClick={() => handleToggleExam(exam.id)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left text-sm transition ${
                        isAssigned
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{exam.title}</p>
                        <p className="text-xs text-gray-500">
                          {exam._count?.questions ?? 0}문제 ·{' '}
                          {Math.floor(exam.duration / 60)}분 ·{' '}
                          <span
                            className={exam.isPublished ? 'text-green-600' : 'text-yellow-600'}
                          >
                            {exam.isPublished ? '공개' : '비공개'}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isAssigned
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isAssigned ? '할당됨' : '미할당'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button onClick={() => setAssignTarget(null)}>완료</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
