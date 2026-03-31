// app/admin/users/page.tsx
// 역할: 관리자 사용자 관리 페이지
// 기능:
// 1. 전체 사용자 목록 조회
// 2. 사용자 계정 직접 생성 (이름, 이메일, 비밀번호, role 지정)
// 3. 엑셀 파일로 사용자 일괄 생성
// 4. role 변경 (USER ↔ ADMIN)
// 5. 사용자별 시험 할당 관리 (모달에서 처리)
// 6. 사용자 삭제

'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { usersApi, UserSummary, AssignedUser, BulkUserInput } from '@/lib/api/users';
import { examsApi } from '@/lib/api/exams';
import { AdminExam } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

interface ExcelUserRow {
  이름: string;
  이메일: string;
  '비밀번호(8자 이상)': string;
  '권한(USER/ADMIN)': string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 사용자 생성 모드: 'single' | 'excel' | null
  const [createMode, setCreateMode] = useState<'single' | 'excel' | null>(null);

  // 개별 생성 폼
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', role: 'USER' as 'USER' | 'ADMIN',
  });
  const [isCreating, setIsCreating] = useState(false);

  // 엑셀 일괄 생성
  const [excelPreview, setExcelPreview] = useState<ExcelUserRow[]>([]);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: { email: string; reason: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const resetCreateMode = () => {
    setCreateMode(null);
    setCreateForm({ name: '', email: '', password: '', role: 'USER' });
    setExcelPreview([]);
    setExcelError(null);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ───── 개별 사용자 생성 ─────
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      await usersApi.create(createForm);
      resetCreateMode();
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // ───── 엑셀 파싱 ─────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelError(null);
    setExcelPreview([]);
    setUploadResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['사용자목록'];
        if (!ws) { setExcelError("'사용자목록' 시트를 찾을 수 없습니다. 샘플 파일 형식을 확인해주세요."); return; }

        const rows = XLSX.utils.sheet_to_json<ExcelUserRow>(ws);
        if (rows.length === 0) { setExcelError('데이터가 없습니다. 최소 1명 이상 입력해주세요.'); return; }

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r['이름']?.toString().trim()) { setExcelError(`${i + 2}행: 이름이 비어있습니다.`); return; }
          if (!r['이메일']?.toString().trim()) { setExcelError(`${i + 2}행: 이메일이 비어있습니다.`); return; }
          const pw = r['비밀번호(8자 이상)']?.toString();
          if (!pw || pw.length < 8) { setExcelError(`${i + 2}행: 비밀번호는 8자 이상이어야 합니다.`); return; }
          const role = r['권한(USER/ADMIN)']?.toString().toUpperCase();
          if (!['USER', 'ADMIN'].includes(role)) { setExcelError(`${i + 2}행: 권한은 USER 또는 ADMIN이어야 합니다.`); return; }
        }

        setExcelPreview(rows);
      } catch {
        setExcelError('파일을 읽는 중 오류가 발생했습니다. 올바른 .xlsx 파일인지 확인해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExcelUpload = async () => {
    if (excelPreview.length === 0) return;
    setIsUploading(true);
    setError(null);

    try {
      const users: BulkUserInput[] = excelPreview.map((r) => ({
        name: r['이름'].toString().trim(),
        email: r['이메일'].toString().trim(),
        password: r['비밀번호(8자 이상)'].toString(),
        role: r['권한(USER/ADMIN)'].toString().toUpperCase() as 'USER' | 'ADMIN',
      }));

      const result = await usersApi.bulkCreate(users);
      setUploadResult(result);
      setExcelPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // ───── role 변경 ─────
  const handleRoleChange = async (userId: string, currentRole: 'USER' | 'ADMIN') => {
    const newRole = currentRole === 'USER' ? 'ADMIN' : 'USER';
    try {
      await usersApi.updateRole(userId, newRole);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'role 변경 중 오류가 발생했습니다.');
    }
  };

  // ───── 사용자 삭제 ─────
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

  // ───── 시험 할당 모달 ─────
  const openAssignModal = async (user: UserSummary) => {
    setAssignTarget(user);
    setIsLoadingExams(true);
    try {
      const exams = await examsApi.getAllAdmin();
      setAllExams(exams);
      const assignedIds = new Set<string>();
      for (const exam of exams) {
        try {
          const assignedUsers = await usersApi.getByExam(exam.id);
          if (assignedUsers.some((u: AssignedUser) => u.id === user.id)) {
            assignedIds.add(exam.id);
          }
        } catch { /* 무시 */ }
      }
      setAssignedExamIds(assignedIds);
    } finally {
      setIsLoadingExams(false);
    }
  };

  const handleToggleExam = async (examId: string) => {
    if (!assignTarget) return;
    try {
      if (assignedExamIds.has(examId)) {
        await usersApi.removeFromExam(examId, assignTarget.id);
        setAssignedExamIds((prev) => { const s = new Set(prev); s.delete(examId); return s; });
      } else {
        await usersApi.assignToExam(examId, assignTarget.id);
        setAssignedExamIds((prev) => new Set(Array.from(prev).concat(examId)));
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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => createMode === 'excel' ? resetCreateMode() : (resetCreateMode(), setCreateMode('excel'))}
          >
            {createMode === 'excel' ? '취소' : '📥 엑셀 일괄 생성'}
          </Button>
          <Button
            onClick={() => createMode === 'single' ? resetCreateMode() : (resetCreateMode(), setCreateMode('single'))}
          >
            {createMode === 'single' ? '취소' : '+ 계정 생성'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── 엑셀 일괄 생성 섹션 ── */}
      {createMode === 'excel' && (
        <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-5">
          <h2 className="mb-1 font-semibold text-purple-800">엑셀 일괄 계정 생성</h2>
          <p className="mb-3 text-sm text-purple-700">
            샘플 파일 형식에 맞춰 작성한 .xlsx 파일을 업로드하면 계정이 자동으로 생성됩니다.
          </p>

          {/* 컬럼 형식 안내 */}
          <div className="mb-4 rounded-lg border border-purple-200 bg-white px-4 py-3 text-sm">
            <p className="font-medium text-gray-700 mb-1">엑셀 컬럼 형식</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-gray-600">
                <thead>
                  <tr className="bg-gray-100">
                    {['이름', '이메일', '비밀번호(8자 이상)', '권한(USER/ADMIN)'].map((h) => (
                      <th key={h} className="border border-gray-200 px-2 py-1 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-2 py-1">홍길동</td>
                    <td className="border border-gray-200 px-2 py-1">hong@example.com</td>
                    <td className="border border-gray-200 px-2 py-1">password123</td>
                    <td className="border border-gray-200 px-2 py-1 font-medium">USER</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-600 file:px-3 file:py-2 file:text-white file:text-sm file:cursor-pointer hover:file:bg-purple-700"
            />
          </div>

          {excelError && (
            <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{excelError}</div>
          )}

          {/* 업로드 결과 */}
          {uploadResult && (
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-800">✅ {uploadResult.success}명 생성 완료</p>
              {uploadResult.failed.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-red-700">❌ {uploadResult.failed.length}명 실패:</p>
                  {uploadResult.failed.map((f, i) => (
                    <p key={i} className="text-red-600 ml-2">• {f.email}: {f.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 미리보기 */}
          {excelPreview.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-gray-700">
                미리보기 ({excelPreview.length}명)
              </p>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {excelPreview.map((row, idx) => {
                  const role = row['권한(USER/ADMIN)']?.toString().toUpperCase();
                  return (
                    <div key={idx} className="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-sm last:border-0">
                      <div>
                        <span className="font-medium text-gray-800">{row['이름']}</span>
                        <span className="ml-2 text-gray-500">{row['이메일']}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {role === 'ADMIN' ? '관리자' : '일반'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Button
                className="mt-3"
                isLoading={isUploading}
                onClick={handleExcelUpload}
              >
                {excelPreview.length}명 계정 생성
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── 개별 계정 생성 폼 ── */}
      {createMode === 'single' && (
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

      {/* ── 사용자 목록 ── */}
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
                <Button variant="secondary" size="sm" onClick={() => openAssignModal(user)}>
                  시험 할당
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleRoleChange(user.id, user.role)}>
                  {user.role === 'USER' ? '관리자로' : '일반으로'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleteTargetId(user.id)}>
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
                          <span className={exam.isPublished ? 'text-green-600' : 'text-yellow-600'}>
                            {exam.isPublished ? '공개' : '비공개'}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isAssigned ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
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
