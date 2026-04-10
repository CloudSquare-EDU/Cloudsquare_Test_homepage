// app/admin/users/page.tsx
'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { usersApi, UserSummary, BulkUserInput } from '@/lib/api/users';
import { coursesApi } from '@/lib/api/courses';
import { CourseSummary } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';
import { downloadSampleExcel } from '@/lib/utils';

const handleDownloadUserSample = () => {
  downloadSampleExcel(
    [
      ['이름', '이메일', '비밀번호(8자 이상)', '권한(USER/ADMIN)'],
      ['홍길동', 'hong@example.com', 'password123', 'USER'],
      ['김관리', 'admin@example.com', 'admin1234', 'USER'],
      ['이수강', 'lee@example.com', 'pass5678', 'USER'],
    ],
    '사용자목록',
    '계정_일괄생성_샘플',
  );
};

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

  // 다중 선택 삭제
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectableIds = users.filter((u) => u.role !== 'ADMIN').map((u) => u.id);
    if (selectableIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => usersApi.delete(id)));
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // 비밀번호 초기화 모달
  const [pwResetTarget, setPwResetTarget] = useState<UserSummary | null>(null);
  const [pwResetValue, setPwResetValue] = useState('');
  const [pwResetError, setPwResetError] = useState<string | null>(null);
  const [isResettingPw, setIsResettingPw] = useState(false);

  // 과정 배정 모달
  const [courseTarget, setCourseTarget] = useState<UserSummary | null>(null);
  const [allCourses, setAllCourses] = useState<CourseSummary[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isAssigningCourse, setIsAssigningCourse] = useState(false);

  const loadUsers = () => {
    setIsLoading(true);
    usersApi.getAll()
      .then((data) => setUsers([...data].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }))))
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

  const handlePwReset = async () => {
    if (!pwResetTarget) return;
    if (pwResetValue.length < 8) { setPwResetError('비밀번호는 8자 이상이어야 합니다.'); return; }
    setIsResettingPw(true);
    setPwResetError(null);
    try {
      await usersApi.resetPassword(pwResetTarget.id, pwResetValue);
      setPwResetTarget(null);
      setPwResetValue('');
    } catch (err) {
      setPwResetError(err instanceof ApiError ? err.message : '비밀번호 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsResettingPw(false);
    }
  };

  // ── 과정 배정 ───────────────────────────────────────────────
  const openCourseModal = async (user: UserSummary) => {
    setCourseTarget(user);
    setIsLoadingCourses(true);
    try {
      const courses = await coursesApi.getAll();
      setAllCourses(courses);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const handleAssignCourse = async (courseId: string) => {
    if (!courseTarget) return;
    setIsAssigningCourse(true);
    try {
      await coursesApi.assignUser(courseId, courseTarget.id);
      loadUsers();
      // 모달 내 courseTarget 갱신 (배지 업데이트)
      const course = allCourses.find((c) => c.id === courseId);
      if (course) {
        setCourseTarget((prev) => prev ? { ...prev, courseId: courseId, course: { id: courseId, name: course.name } } : prev);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '과정 배정 중 오류가 발생했습니다.');
    } finally {
      setIsAssigningCourse(false);
    }
  };

  const handleRemoveCourse = async () => {
    if (!courseTarget || !courseTarget.courseId) return;
    setIsAssigningCourse(true);
    try {
      await coursesApi.removeUser(courseTarget.courseId, courseTarget.id);
      loadUsers();
      setCourseTarget((prev) => prev ? { ...prev, courseId: null, course: null } : prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '과정 해제 중 오류가 발생했습니다.');
    } finally {
      setIsAssigningCourse(false);
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
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">계정 생성 및 시험/과정 할당을 관리하세요</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowBulkDeleteConfirm(true)}
            >
              선택 삭제 ({selectedIds.size}명)
            </Button>
          )}
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
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">엑셀 일괄 계정 생성</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                샘플 파일 형식에 맞춰 작성한 .xlsx 파일을 업로드하면 계정이 자동으로 생성됩니다.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleDownloadUserSample}>
              📋 샘플 다운로드
            </Button>
          </div>

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
          {/* 전체 선택 헤더 */}
          {users.some((u) => u.role !== 'ADMIN') && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-2">
              <input
                type="checkbox"
                checked={users.filter((u) => u.role !== 'ADMIN').every((u) => selectedIds.has(u.id)) && selectedIds.size > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 cursor-pointer accent-[#5e6ad2]"
              />
              <span className="text-xs text-[var(--text-muted)]">
                {selectedIds.size > 0 ? `${selectedIds.size}명 선택됨` : '전체 선택 (관리자 제외)'}
              </span>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)]"
                >
                  선택 해제
                </button>
              )}
            </div>
          )}
          {users.map((user) => {
            const isSelected = selectedIds.has(user.id);
            const isAdmin = user.role === 'ADMIN';
            return (
            <div
              key={user.id}
              className={`flex items-center gap-4 rounded-lg border bg-[var(--bg-surface)] px-5 py-4 hover:border-[var(--border-hover)] transition-colors ${
                isSelected ? 'border-[#5e6ad2]/50 bg-[rgba(94,106,210,0.04)]' : 'border-[var(--border)]'
              }`}
            >
              {/* 체크박스 */}
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isAdmin}
                onChange={() => !isAdmin && toggleSelect(user.id)}
                className="h-4 w-4 cursor-pointer accent-[#5e6ad2] disabled:cursor-not-allowed disabled:opacity-30"
              />
              {/* 아바타 */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-raised)] text-sm font-semibold text-[#5e6ad2]">
                {user.name.charAt(0)}
              </div>

              {/* 사용자 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-[var(--text-primary)] truncate">{user.name}</p>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    user.role === 'ADMIN' ? 'bg-[var(--bg-raised)] text-[#5e6ad2]' : 'bg-[var(--bg-raised)] text-[var(--text-muted)]'
                  }`}>
                    {user.role === 'ADMIN' ? '관리자' : '일반'}
                  </span>
                  {/* 과정 배지 */}
                  {user.course && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[rgba(94,106,210,0.12)] text-[#5e6ad2] border border-[rgba(94,106,210,0.25)]">
                      {user.course.name}
                    </span>
                  )}
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
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <Button variant="secondary" size="sm" onClick={() => openCourseModal(user)}>
                  과정 배정
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setPwResetTarget(user); setPwResetValue(''); setPwResetError(null); }}>
                  비번 초기화
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleRoleChange(user.id, user.role)}>
                  {user.role === 'USER' ? '관리자로' : '일반으로'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleteTargetId(user.id)}>
                  삭제
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* 단일 삭제 확인 모달 */}
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

      {/* 일괄 삭제 확인 모달 */}
      <Modal
        isOpen={showBulkDeleteConfirm}
        title={`${selectedIds.size}명을 삭제하시겠습니까?`}
        message="선택한 사용자와 모든 응시 기록이 삭제됩니다. 이 작업은 복구할 수 없습니다."
        confirmLabel={`${selectedIds.size}명 삭제`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        isLoading={isBulkDeleting}
      />

      {/* ── 비밀번호 초기화 모달 ── */}
      {pwResetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPwResetTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <p className="font-semibold text-[var(--text-primary)]">비밀번호 초기화</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{pwResetTarget.name} ({pwResetTarget.email})</p>
            </div>
            <div className="px-5 py-4">
              <Input
                label="새 비밀번호 (8자 이상)"
                type="password"
                value={pwResetValue}
                onChange={(e) => { setPwResetValue(e.target.value); setPwResetError(null); }}
                placeholder="새 비밀번호 입력"
                autoFocus
              />
              {pwResetError && (
                <p className="mt-1.5 text-xs text-[var(--danger-text)]">{pwResetError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setPwResetTarget(null)}>취소</Button>
              <Button variant="primary" size="sm" onClick={handlePwReset} disabled={isResettingPw}>
                {isResettingPw ? '처리 중...' : '초기화'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 과정 배정 모달 ── */}
      {courseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCourseTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-hover)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">과정 배정</h2>
            <p className="mb-1 text-sm text-[var(--text-muted)]">
              <span className="text-[var(--text-secondary)]">{courseTarget.name}</span>을(를) 배정할 과정을 선택하세요.
            </p>

            {/* 현재 과정 표시 */}
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs text-[var(--text-faint)]">현재 과정:</span>
              {courseTarget.course ? (
                <div className="flex items-center gap-2">
                  <span className="rounded px-2 py-0.5 text-xs font-medium bg-[rgba(94,106,210,0.12)] text-[#5e6ad2] border border-[rgba(94,106,210,0.25)]">
                    {courseTarget.course.name}
                  </span>
                  <button
                    onClick={handleRemoveCourse}
                    disabled={isAssigningCourse}
                    className="text-[10px] text-[var(--danger-text)] hover:underline disabled:opacity-50"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <span className="text-xs text-[var(--text-faint)]">없음</span>
              )}
            </div>

            {isLoadingCourses ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
              </div>
            ) : allCourses.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">등록된 과정이 없습니다.</p>
            ) : (
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                {allCourses.map((course) => {
                  const isSelected = courseTarget.courseId === course.id;
                  return (
                    <button
                      key={course.id}
                      onClick={() => handleAssignCourse(course.id)}
                      disabled={isAssigningCourse || isSelected}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${
                        isSelected
                          ? 'border-[rgba(94,106,210,0.4)] bg-[var(--bg-raised)] opacity-80'
                          : 'border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${isSelected ? 'text-[#5e6ad2]' : 'text-[var(--text-secondary)]'}`}>
                          {course.name}
                        </p>
                        {course.description && (
                          <p className="mt-0.5 text-xs text-[var(--text-faint)] truncate max-w-[240px]">{course.description}</p>
                        )}
                        <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                          사용자 {course._count.users}명 · 시험 {course._count.exams}개
                        </p>
                      </div>
                      {isSelected && (
                        <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium bg-[#5e6ad2] text-white">
                          현재
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button size="sm" onClick={() => setCourseTarget(null)}>완료</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
