// app/admin/users/page.tsx
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

const formatDuration = (s: number) => {
  if (s === 0) return '제한 없음';
  if (s < 3600) return `${Math.floor(s / 60)}분`;
  return `${Math.floor(s / 3600)}시간`;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createMode, setCreateMode] = useState<'single' | 'excel' | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', role: 'USER' as 'USER' | 'ADMIN',
  });
  const [isCreating, setIsCreating] = useState(false);

  const [excelPreview, setExcelPreview] = useState<ExcelUserRow[]>([]);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: { email: string; reason: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        if (!ws) { setExcelError("'사용자목록' 시트를 찾을 수 없습니다."); return; }
        const rows = XLSX.utils.sheet_to_json<ExcelUserRow>(ws);
        if (rows.length === 0) { setExcelError('데이터가 없습니다.'); return; }
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
        setExcelError('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExcelUpload = async () => {
    if (excelPreview.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      const bulkUsers: BulkUserInput[] = excelPreview.map((r) => ({
        name: r['이름'].toString().trim(),
        email: r['이메일'].toString().trim(),
        password: r['비밀번호(8자 이상)'].toString(),
        role: r['권한(USER/ADMIN)'].toString().toUpperCase() as 'USER' | 'ADMIN',
      }));
      const result = await usersApi.bulkCreate(bulkUsers);
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

  const handleRoleChange = async (userId: string, currentRole: 'USER' | 'ADMIN') => {
    const newRole = currentRole === 'USER' ? 'ADMIN' : 'USER';
    try {
      await usersApi.updateRole(userId, newRole);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'role 변경 중 오류가 발생했습니다.');
    }
  };

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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">사용자 관리</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">계정 생성 및 시험 할당을 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => createMode === 'excel' ? resetCreateMode() : (resetCreateMode(), setCreateMode('excel'))}
          >
            {createMode === 'excel' ? '취소' : '엑셀 일괄 생성'}
          </Button>
          <Button
            size="sm"
            onClick={() => createMode === 'single' ? resetCreateMode() : (resetCreateMode(), setCreateMode('single'))}
          >
            {createMode === 'single' ? '취소' : '+ 계정 생성'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      )}

      {/* ── 개별 계정 생성 폼 ── */}
      {createMode === 'single' && (
        <form onSubmit={handleCreate} className="mb-5 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">새 계정 생성</h2>
          <div className="flex flex-col gap-3">
            <Input label="이름" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="홍길동" required autoFocus />
            <Input label="이메일" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="user@example.com" required />
            <Input label="비밀번호" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="8자 이상" required />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">권한</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'USER' | 'ADMIN' })}
                className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
              >
                <option value="USER">일반 사용자</option>
                <option value="ADMIN">관리자</option>
              </select>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" isLoading={isCreating} size="sm">생성</Button>
            </div>
          </div>
        </form>
      )}

      {/* ── 엑셀 일괄 생성 섹션 ── */}
      {createMode === 'excel' && (
        <div className="mb-5 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">엑셀 일괄 계정 생성</h2>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            샘플 파일 형식에 맞춰 작성한 .xlsx 파일을 업로드하면 계정이 자동으로 생성됩니다.
          </p>

          {/* 컬럼 형식 안내 */}
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-xs">
            <p className="mb-2 font-medium text-[var(--text-secondary)]">엑셀 컬럼 형식</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[var(--text-muted)]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    {['이름', '이메일', '비밀번호(8자 이상)', '권한(USER/ADMIN)'].map((h) => (
                      <th key={h} className="pb-1.5 pr-4 text-left font-medium text-[var(--text-secondary)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="pt-1.5 pr-4">홍길동</td>
                    <td className="pt-1.5 pr-4">hong@example.com</td>
                    <td className="pt-1.5 pr-4">password123</td>
                    <td className="pt-1.5 pr-4 text-[#5e6ad2]">USER</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block text-xs text-[var(--text-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[#5e6ad2] file:px-3 file:py-1.5 file:text-white file:text-xs file:cursor-pointer hover:file:bg-[#6b78e5]"
            />
          </div>

          {excelError && (
            <div className="mb-3 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
              {excelError}
            </div>
          )}

          {uploadResult && (
            <div className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-xs">
              <p className="font-medium text-[var(--success-text)]">{uploadResult.success}명 생성 완료</p>
              {uploadResult.failed.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[var(--danger-text)]">{uploadResult.failed.length}명 실패:</p>
                  {uploadResult.failed.map((f, i) => (
                    <p key={i} className="ml-2 text-[var(--danger-text)]">• {f.email}: {f.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {excelPreview.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">미리보기 ({excelPreview.length}명)</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-inset)]">
                {excelPreview.map((row, idx) => {
                  const role = row['권한(USER/ADMIN)']?.toString().toUpperCase();
                  return (
                    <div key={idx} className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2 text-xs last:border-0">
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">{row['이름']}</span>
                        <span className="ml-2 text-[var(--text-muted)]">{row['이메일']}</span>
                      </div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        role === 'ADMIN' ? 'bg-[var(--bg-raised)] text-[#5e6ad2]' : 'bg-[var(--bg-raised)] text-[var(--text-muted)]'
                      }`}>
                        {role === 'ADMIN' ? '관리자' : '일반'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" isLoading={isUploading} onClick={handleExcelUpload}>
                  {excelPreview.length}명 계정 생성
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 사용자 목록 ── */}
      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">등록된 사용자가 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4 hover:border-[var(--border-hover)] transition-colors"
            >
              {/* 아바타 */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-raised)] text-sm font-semibold text-[#5e6ad2]">
                {user.name.charAt(0)}
              </div>

              {/* 사용자 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--text-primary)] truncate">{user.name}</p>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    user.role === 'ADMIN' ? 'bg-[var(--bg-raised)] text-[#5e6ad2]' : 'bg-[var(--bg-raised)] text-[var(--text-muted)]'
                  }`}>
                    {user.role === 'ADMIN' ? '관리자' : '일반'}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>{user.email}</span>
                  <span>·</span>
                  <span>응시 {user._count.submissions}회</span>
                  <span>·</span>
                  <span>할당 {user._count.userExams}개</span>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2 shrink-0">
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
          ))}
        </div>
      )}

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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setAssignTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-hover)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">시험 할당</h2>
            <p className="mb-5 text-sm text-[var(--text-muted)]">
              <span className="text-[var(--text-secondary)]">{assignTarget.name}</span>에게 접근 허용할 시험을 선택하세요.
            </p>

            {isLoadingExams ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
              </div>
            ) : allExams.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">등록된 시험이 없습니다.</p>
            ) : (
              <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                {allExams.map((exam) => {
                  const isAssigned = assignedExamIds.has(exam.id);
                  return (
                    <button
                      key={exam.id}
                      onClick={() => handleToggleExam(exam.id)}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        isAssigned
                          ? 'border-[rgba(94,106,210,0.4)] bg-[var(--bg-raised)]'
                          : 'border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${isAssigned ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                          {exam.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                          문제 {exam._count?.questions ?? 0}개 · {formatDuration(exam.duration)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${
                        isAssigned
                          ? 'bg-[#5e6ad2] text-white'
                          : 'bg-[var(--bg-raised)] text-[var(--text-muted)]'
                      }`}>
                        {isAssigned ? '할당됨' : '미할당'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button size="sm" onClick={() => setAssignTarget(null)}>완료</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
