// app/admin/exams/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { coursesApi } from '@/lib/api/courses';
import { questionBanksApi } from '@/lib/api/questionBanks';
import { AdminExam, CourseSummary, QuestionBankSummary } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { ApiError } from '@/lib/api/client';
import { formatDuration } from '@/lib/utils';

const PAGE_LIMIT = 20;

export default function AdminExamsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', duration: 3600, courseId: '', questionBankId: '', questionCount: '', startDate: '', deadline: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 과정 목록
  const [allCourses, setAllCourses] = useState<CourseSummary[]>([]);
  // 문제은행 목록
  const [allBanks, setAllBanks] = useState<QuestionBankSummary[]>([]);

  // 과정 변경 모달
  const [courseTarget, setCourseTarget] = useState<AdminExam | null>(null);
  const [isAssigningCourse, setIsAssigningCourse] = useState(false);

  // 기간 설정 모달
  const [dateTarget, setDateTarget] = useState<AdminExam | null>(null);
  const [dateForm, setDateForm] = useState({ startDate: '', deadline: '' });
  const [isSavingDate, setIsSavingDate] = useState(false);

  const openDateModal = (exam: AdminExam) => {
    setDateTarget(exam);
    setDateForm({
      startDate: exam.startDate ? new Date(exam.startDate).toISOString().slice(0, 16) : '',
      deadline: exam.deadline ? new Date(exam.deadline).toISOString().slice(0, 16) : '',
    });
  };

  const handleSaveDates = async () => {
    if (!dateTarget) return;
    setIsSavingDate(true);
    try {
      await examsApi.update(dateTarget.id, {
        startDate: dateForm.startDate ? new Date(dateForm.startDate).toISOString() : null,
        deadline: dateForm.deadline ? new Date(dateForm.deadline).toISOString() : null,
      });
      setDateTarget(null);
      loadExams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '기간 설정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingDate(false);
    }
  };

  const loadExams = (p = page, s = search) => {
    setIsLoading(true);
    examsApi.getAllAdmin({ page: p, limit: PAGE_LIMIT, search: s || undefined })
      .then((res) => {
        setExams(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(() => setError('시험 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  };

  const loadCourses = () => {
    coursesApi.getAll()
      .then((res) => setAllCourses(res.data))
      .catch(() => { /* 무시 */ });
  };

  const loadBanks = () => {
    questionBanksApi.getAll()
      .then(setAllBanks)
      .catch(() => { /* 무시 */ });
  };

  useEffect(() => { loadExams(page, search); }, [page, search]);
  useEffect(() => { loadCourses(); loadBanks(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handlePageChange = (p: number) => setPage(p);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const created = await examsApi.create({
        title: form.title,
        description: form.description || undefined,
        duration: form.duration,
        questionBankId: form.questionBankId || undefined,
        questionCount: form.questionCount ? parseInt(form.questionCount, 10) : undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      });
      // 과정 매핑
      if (form.courseId && created.id) {
        await coursesApi.assignExam(form.courseId, created.id);
      }
      setShowCreate(false);
      setForm({ title: '', description: '', duration: 3600, courseId: '', questionBankId: '', questionCount: '', startDate: '', deadline: '' });
      loadExams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await examsApi.delete(deleteTargetId);
      setDeleteTargetId(null);
      loadExams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── 과정 변경 ───────────────────────────────────────────────
  const handleAssignCourse = async (courseId: string) => {
    if (!courseTarget) return;
    setIsAssigningCourse(true);
    try {
      await coursesApi.assignExam(courseId, courseTarget.id);
      const course = allCourses.find((c) => c.id === courseId);
      if (course) {
        setCourseTarget((prev) => prev ? { ...prev, courseId: courseId, course: { id: courseId, name: course.name } } : prev);
      }
      loadExams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '과정 매핑 중 오류가 발생했습니다.');
    } finally {
      setIsAssigningCourse(false);
    }
  };

  const handleRemoveCourse = async () => {
    if (!courseTarget || !courseTarget.courseId) return;
    setIsAssigningCourse(true);
    try {
      await coursesApi.removeExam(courseTarget.courseId, courseTarget.id);
      setCourseTarget((prev) => prev ? { ...prev, courseId: null, course: null } : prev);
      loadExams();
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">시험 관리</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            시험 생성 시 과정을 매핑하거나, 목록에서 과정을 변경할 수 있습니다
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} size="sm" className="whitespace-nowrap self-start">
          {showCreate ? '취소' : '+ 시험 생성'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      )}

      {/* 시험 생성 폼 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-5 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">새 시험 생성</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="시험 제목"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 2025 상반기 모의고사"
              required
              autoFocus
            />
            <Input
              label="설명 (선택)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="시험에 대한 간단한 설명"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">제한 시간</label>
              <div className="flex items-center gap-2">
                <select
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value={1800}>30분</option>
                  <option value={3600}>60분</option>
                  <option value={5400}>90분</option>
                  <option value={7200}>120분</option>
                  <option value={0}>제한 없음</option>
                </select>
                <span className="text-xs text-[var(--text-faint)]">또는 직접 입력 (초)</span>
                <input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="h-8 w-24 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
                  min={0}
                />
              </div>
            </div>
            {/* 문제은행 연결 (선택) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">문제은행 연결 (선택)</label>
              <select
                value={form.questionBankId}
                onChange={(e) => setForm({ ...form, questionBankId: e.target.value, questionCount: '' })}
                className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
              >
                <option value="">문제은행 없음 (수동 등록)</option>
                {allBanks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b._count.questions}문제)</option>
                ))}
              </select>
              {form.questionBankId && (
                <div className="mt-1 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">사용자별 출제 문제 수</label>
                  <input
                    type="number"
                    value={form.questionCount}
                    onChange={(e) => setForm({ ...form, questionCount: e.target.value })}
                    placeholder={`최대 ${allBanks.find((b) => b.id === form.questionBankId)?._count.questions ?? '?'}개`}
                    className="h-8 w-32 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
                    min={1}
                  />
                  <p className="text-[10px] text-[#5e6ad2]">
                    각 계정마다 문제은행에서 이 수만큼 랜덤 배정됩니다.
                  </p>
                </div>
              )}
            </div>
            {/* 과정 매핑 (선택) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">과정 매핑 (선택)</label>
              <select
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
              >
                <option value="">과정 없음</option>
                {allCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {form.courseId && (
                <p className="text-[10px] text-[var(--text-faint)]">
                  이 과정에 속한 계정들은 시험에 자동으로 접근할 수 있습니다.
                </p>
              )}
            </div>
            {/* 응시 기간 (시작일 / 마감일) */}
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">응시 시작일 (선택)</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
                />
                <p className="text-[10px] text-[var(--text-faint)]">설정 전까지 응시 불가</p>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">응시 마감일 (선택)</label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
                />
                <p className="text-[10px] text-[var(--text-faint)]">설정하지 않으면 기한 없음</p>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" isLoading={isCreating} size="sm">생성</Button>
            </div>
          </div>
        </form>
      )}

      {/* 검색 */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <Input
          placeholder="시험명 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" size="sm">검색</Button>
        {search && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}>초기화</Button>
        )}
      </form>

      {/* 시험 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">{search ? `"${search}" 검색 결과가 없습니다` : '등록된 시험이 없습니다'}</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">위 버튼으로 시험을 생성하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-4 hover:border-[var(--border-hover)] transition-colors sm:px-5 flex flex-col md:flex-row md:items-center md:gap-3"
            >
              {/* 시험 정보 */}
              <div className="flex flex-1 min-w-0 items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-raised)] text-[#5e6ad2]">
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                    <path d="M10 2v3h3M5 8h6M5 11h4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  {/* 제목 + 배지 */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium text-[var(--text-primary)] break-all">{exam.title}</p>
                    {exam.questionBank && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[rgba(110,180,110,0.12)] text-[#4a9e5c] border border-[rgba(110,180,110,0.25)]">
                        🏦 {exam.questionBank.name}
                      </span>
                    )}
                    {exam.course && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[rgba(94,106,210,0.12)] text-[#5e6ad2] border border-[rgba(94,106,210,0.25)]">
                        {exam.course.name}
                      </span>
                    )}
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      exam.isPublished
                        ? 'bg-[var(--success-bg)] text-[var(--success-text)]'
                        : 'bg-[var(--bg-raised)] text-[var(--text-muted)]'
                    }`}>
                      {exam.isPublished ? '공개' : '비공개'}
                    </span>
                  </div>
                  {/* 메타 정보 — 모바일에선 줄바꿈 허용 */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
                    <span>
                      {exam.questionBank
                        ? `문제은행 ${exam.questionBank._count.questions}개 중 ${exam.questionCount ?? '전체'}개`
                        : `문제 ${exam._count.questions}개`}
                    </span>
                    <span className="text-[var(--border)]">·</span>
                    <span>응시 {exam._count.submissions}회</span>
                    <span className="text-[var(--border)]">·</span>
                    <span>{formatDuration(exam.duration)}</span>
                    {exam.startDate && (
                      <span className={new Date(exam.startDate) > new Date() ? 'text-[#5e6ad2]' : 'text-[var(--text-faint)]'}>
                        시작 {new Date(exam.startDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {exam.deadline && (
                      <span className={new Date(exam.deadline) < new Date() ? 'text-[var(--danger-text)]' : 'text-[var(--warning-text)]'}>
                        마감 {new Date(exam.deadline).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 액션 버튼: 모바일-하단분리 / 데스크탑-우측인라인 */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3 md:mt-0 md:border-t-0 md:pt-0 md:shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openDateModal(exam)}>
                  기간 설정
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCourseTarget(exam)}>
                  과정 변경
                </Button>
                <Link href={`/admin/exams/${exam.id}/questions`}>
                  <Button variant="secondary" size="sm">문제 관리</Button>
                </Link>
                <Button variant="danger" size="sm" onClick={() => setDeleteTargetId(exam.id)}>
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <Pagination page={page} totalPages={totalPages} total={total} limit={PAGE_LIMIT} onPageChange={handlePageChange} />
        </div>
      )}

      <Modal
        isOpen={!!deleteTargetId}
        title="시험을 삭제하시겠습니까?"
        message="시험과 모든 응시 기록이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
        isLoading={isDeleting}
      />

      {/* ── 기간 설정 모달 ── */}
      {dateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDateTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-[var(--border-hover)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">응시 기간 설정</h2>
            <p className="mb-4 text-sm text-[var(--text-muted)] truncate">{dateTarget.title}</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">응시 시작일 (선택)</label>
                <input
                  type="datetime-local"
                  value={dateForm.startDate}
                  onChange={(e) => setDateForm({ ...dateForm, startDate: e.target.value })}
                  className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
                />
                <p className="text-[10px] text-[var(--text-faint)]">비우면 즉시 응시 가능</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">응시 마감일 (선택)</label>
                <input
                  type="datetime-local"
                  value={dateForm.deadline}
                  onChange={(e) => setDateForm({ ...dateForm, deadline: e.target.value })}
                  className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2]"
                />
                <p className="text-[10px] text-[var(--text-faint)]">비우면 기한 없음</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDateTarget(null)}>취소</Button>
              <Button size="sm" onClick={handleSaveDates} isLoading={isSavingDate}>저장</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 과정 변경 모달 ── */}
      {courseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCourseTarget(null)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-[var(--border-hover)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">과정 변경</h2>
            <p className="mb-1 break-words text-sm text-[var(--text-muted)]">
              <span className="text-[var(--text-secondary)]">{courseTarget.title}</span>을(를) 매핑할 과정을 선택하세요.
            </p>

            {/* 현재 과정 */}
            <div className="mb-4">
              <span className="text-xs text-[var(--text-faint)]">현재 과정:</span>
              {courseTarget.course ? (
                <div className="mt-1 flex min-w-0 items-start gap-2">
                  <span className="min-w-0 break-words rounded px-2 py-0.5 text-xs font-medium bg-[rgba(94,106,210,0.12)] text-[#5e6ad2] border border-[rgba(94,106,210,0.25)]">
                    {courseTarget.course.name}
                  </span>
                  <button
                    onClick={handleRemoveCourse}
                    disabled={isAssigningCourse}
                    className="shrink-0 text-[10px] text-[var(--danger-text)] hover:underline disabled:opacity-50"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <span className="ml-2 text-xs text-[var(--text-faint)]">없음</span>
              )}
            </div>

            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
              {allCourses.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--text-muted)]">등록된 과정이 없습니다.</p>
              ) : (
                allCourses.map((course) => {
                  const isSelected = courseTarget.courseId === course.id;
                  return (
                    <button
                      key={course.id}
                      onClick={() => handleAssignCourse(course.id)}
                      disabled={isAssigningCourse || isSelected}
                      className={`flex items-start justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${
                        isSelected
                          ? 'border-[rgba(94,106,210,0.4)] bg-[var(--bg-raised)] opacity-80'
                          : 'border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`break-words font-medium ${isSelected ? 'text-[#5e6ad2]' : 'text-[var(--text-secondary)]'}`}>
                          {course.name}
                        </p>
                        {course.description && (
                          <p className="mt-0.5 text-xs text-[var(--text-faint)] line-clamp-2">{course.description}</p>
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
                })
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button size="sm" onClick={() => setCourseTarget(null)}>완료</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
