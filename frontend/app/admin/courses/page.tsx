// app/admin/courses/page.tsx
// 역할: 과정 관리 — 생성/삭제, 소속 사용자 및 시험 배정
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { coursesApi } from '@/lib/api/courses';
import { usersApi, UserSummary } from '@/lib/api/users';
import { examsApi } from '@/lib/api/exams';
import { CourseSummary, CourseDetail, AdminExam } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 생성 폼
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 펼쳐진 과정 상세
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, CourseDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // 삭제
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 사용자 배정 모달
  const [assignUserCourseId, setAssignUserCourseId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 시험 배정 모달
  const [assignExamCourseId, setAssignExamCourseId] = useState<string | null>(null);
  const [allExams, setAllExams] = useState<AdminExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  const loadCourses = () => {
    setIsLoading(true);
    coursesApi.getAll()
      .then(setCourses)
      .catch(() => setError('과정 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadCourses(); }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // ── 과정 생성 ────────────────────────────────────────────────
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await coursesApi.create(createName, createDesc || undefined);
      setCreateName('');
      setCreateDesc('');
      setShowCreate(false);
      loadCourses();
      showSuccess('과정이 생성되었습니다.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // ── 과정 상세 토글 ───────────────────────────────────────────
  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (detailMap[id]) return;
    setLoadingDetailId(id);
    try {
      const detail = await coursesApi.getById(id);
      setDetailMap((p) => ({ ...p, [id]: detail }));
    } catch {
      setError('과정 상세를 불러오는 데 실패했습니다.');
    } finally {
      setLoadingDetailId(null);
    }
  };

  const refreshDetail = async (id: string) => {
    try {
      const detail = await coursesApi.getById(id);
      setDetailMap((p) => ({ ...p, [id]: detail }));
    } catch { /* ignore */ }
  };

  // ── 과정 삭제 ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await coursesApi.delete(deleteTargetId);
      setDeleteTargetId(null);
      loadCourses();
      showSuccess('과정이 삭제되었습니다.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── 사용자 배정 모달 ─────────────────────────────────────────
  const openAssignUsers = async (courseId: string) => {
    setAssignUserCourseId(courseId);
    setLoadingUsers(true);
    try {
      const users = await usersApi.getAll();
      setAllUsers(users);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleUser = async (courseId: string, userId: string, currentCourseId: string | null) => {
    try {
      if (currentCourseId === courseId) {
        await coursesApi.removeUser(courseId, userId);
      } else {
        await coursesApi.assignUser(courseId, userId);
      }
      const users = await usersApi.getAll();
      setAllUsers(users);
      await refreshDetail(courseId);
      loadCourses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '배정 중 오류가 발생했습니다.');
    }
  };

  // ── 시험 배정 모달 ───────────────────────────────────────────
  const openAssignExams = async (courseId: string) => {
    setAssignExamCourseId(courseId);
    setLoadingExams(true);
    try {
      const exams = await examsApi.getAllAdmin();
      setAllExams(exams);
    } finally {
      setLoadingExams(false);
    }
  };

  const handleToggleExam = async (courseId: string, examId: string, currentCourseId: string | null) => {
    try {
      if (currentCourseId === courseId) {
        await coursesApi.removeExam(courseId, examId);
      } else {
        await coursesApi.assignExam(courseId, examId);
      }
      const exams = await examsApi.getAllAdmin();
      setAllExams(exams);
      await refreshDetail(courseId);
      loadCourses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '배정 중 오류가 발생했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  const deletingCourse = courses.find((c) => c.id === deleteTargetId);

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">과정 관리</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            과정별로 계정과 시험을 묶어 일괄 관리하세요
          </p>
        </div>
        <Button size="sm" className="whitespace-nowrap self-start" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? '취소' : '+ 과정 생성'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-md border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2.5 text-xs font-medium text-[var(--success-text)]">
          {successMsg}
        </div>
      )}

      {/* 생성 폼 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-5 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">새 과정 생성</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="과정명"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="예: OO대학교 네이버클라우드 아카데미 소버린AI Literacy 과정"
              required
              autoFocus
            />
            <Input
              label="설명 (선택)"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="과정에 대한 간단한 설명"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" isLoading={isCreating}>생성</Button>
            </div>
          </div>
        </form>
      )}

      {/* 과정 목록 */}
      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">생성된 과정이 없습니다</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">과정을 먼저 생성하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {courses.map((course) => {
            const isExpanded = expandedId === course.id;
            const detail = detailMap[course.id];
            const isLoadingDetail = loadingDetailId === course.id;

            return (
              <div key={course.id} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--border-hover)]">
                {/* 헤더 행 */}
                <div className="px-4 py-4 sm:px-5 flex flex-col md:flex-row md:items-center md:gap-3">
                  {/* 펼치기 버튼 */}
                  <button
                    onClick={() => toggleExpand(course.id)}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-raised)] text-[#5e6ad2]">
                      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 3h12M2 6h8M2 9h10M2 12h6" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--text-primary)] truncate">{course.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)]">
                        <span>계정 {course._count.users}명</span>
                        <span className="text-[var(--border)]">·</span>
                        <span>시험 {course._count.exams}개</span>
                      </div>
                    </div>
                    <svg
                      className={`ml-2 h-3.5 w-3.5 shrink-0 text-[var(--text-faint)] transition-transform md:hidden ${isExpanded ? 'rotate-180' : ''}`}
                      viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* 액션 버튼: 모바일-하단분리 / 데스크탑-우측인라인 */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3 md:mt-0 md:border-t-0 md:pt-0 md:shrink-0">
                    <Button variant="secondary" size="sm" onClick={() => openAssignUsers(course.id)}>
                      계정 배정
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => openAssignExams(course.id)}>
                      시험 배정
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteTargetId(course.id)}>
                      삭제
                    </Button>
                    {/* 데스크탑: 펼치기 화살표 버튼 */}
                    <button
                      onClick={() => toggleExpand(course.id)}
                      className="hidden md:flex items-center justify-center h-7 w-7 rounded hover:bg-[var(--bg-raised)] text-[var(--text-faint)]"
                    >
                      <svg
                        className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 상세 (펼침) */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-subtle)]">
                    {isLoadingDetail ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
                      </div>
                    ) : !detail ? null : (
                      <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)] bg-[var(--bg-inset)]">
                        {/* 소속 계정 */}
                        <div className="px-5 py-4">
                          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                            소속 계정 ({detail.users.length}명)
                          </p>
                          {detail.users.length === 0 ? (
                            <p className="text-xs text-[var(--text-faint)]">배정된 계정이 없습니다</p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {[...detail.users].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })).map((u) => (
                                <div key={u.id} className="flex items-center gap-2">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-raised)] text-[9px] font-bold text-[#5e6ad2]">
                                    {u.name.charAt(0)}
                                  </div>
                                  <span className="text-xs text-[var(--text-primary)]">{u.name}</span>
                                  <span className="text-[10px] text-[var(--text-faint)]">{u.email}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* 소속 시험 */}
                        <div className="px-5 py-4">
                          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                            소속 시험 ({detail.exams.length}개)
                          </p>
                          {detail.exams.length === 0 ? (
                            <p className="text-xs text-[var(--text-faint)]">배정된 시험이 없습니다</p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {detail.exams.map((ex) => (
                                <div key={ex.id} className="flex items-center gap-2">
                                  <svg className="h-3.5 w-3.5 shrink-0 text-[#5e6ad2]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                                    <path d="M10 2v3h3M5 8h6M5 11h4" strokeLinecap="round" />
                                  </svg>
                                  <span className="text-xs text-[var(--text-primary)]">{ex.title}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTargetId}
        title="과정을 삭제하시겠습니까?"
        message={`"${deletingCourse?.name}" 과정이 삭제됩니다. 소속 계정과 시험의 과정 배정은 해제되지만 계정/시험 자체는 삭제되지 않습니다.`}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
        isLoading={isDeleting}
      />

      {/* 계정 배정 모달 */}
      {assignUserCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAssignUserCourseId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-hover)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">계정 배정</h2>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              클릭하면 이 과정으로 배정됩니다. 이미 배정된 계정은 다시 클릭하면 해제됩니다.
            </p>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {allUsers.filter((u) => u.role === 'USER').map((u) => {
                  const isInThisCourse = u.courseId === assignUserCourseId;
                  const isInOtherCourse = u.courseId && u.courseId !== assignUserCourseId;
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleToggleUser(assignUserCourseId, u.id, u.courseId)}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        isInThisCourse
                          ? 'border-[rgba(94,106,210,0.4)] bg-[var(--bg-raised)]'
                          : 'border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-raised)] text-xs font-bold text-[#5e6ad2]">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isInThisCourse ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                          {u.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-faint)] truncate">{u.email}</p>
                      </div>
                      {isInThisCourse && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[#5e6ad2] text-white">배정됨</span>
                      )}
                      {isInOtherCourse && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[var(--bg-raised)] text-[var(--text-muted)] truncate max-w-[80px]">
                          {u.course?.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setAssignUserCourseId(null)}>완료</Button>
            </div>
          </div>
        </div>
      )}

      {/* 시험 배정 모달 */}
      {assignExamCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAssignExamCourseId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-hover)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">시험 배정</h2>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              클릭하면 이 과정으로 배정됩니다. 이미 배정된 시험은 다시 클릭하면 해제됩니다.
            </p>
            {loadingExams ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {allExams.map((exam) => {
                  const isInThisCourse = exam.courseId === assignExamCourseId;
                  const isInOtherCourse = exam.courseId && exam.courseId !== assignExamCourseId;
                  return (
                    <button
                      key={exam.id}
                      onClick={() => handleToggleExam(assignExamCourseId, exam.id, exam.courseId)}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        isInThisCourse
                          ? 'border-[rgba(94,106,210,0.4)] bg-[var(--bg-raised)]'
                          : 'border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      <svg className="h-4 w-4 shrink-0 text-[#5e6ad2]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                        <path d="M10 2v3h3M5 8h6M5 11h4" strokeLinecap="round" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isInThisCourse ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                          {exam.title}
                        </p>
                      </div>
                      {isInThisCourse && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[#5e6ad2] text-white">배정됨</span>
                      )}
                      {isInOtherCourse && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[var(--bg-raised)] text-[var(--text-muted)] truncate max-w-[80px]">
                          {exam.course?.name ?? '타 과정'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setAssignExamCourseId(null)}>완료</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
