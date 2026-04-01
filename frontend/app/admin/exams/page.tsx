// app/admin/exams/page.tsx
// 역할: 관리자 시험 목록 — 생성, 삭제, 문제 관리, 사용자 할당
// 변경 이력: '공개' 개념 제거 → 사용자 할당 방식으로 접근 제어 전환
//   - 시험 생성 후 사용자 관리 페이지에서 사용자별 할당
//   - isPublished 뱃지 제거, 응시 수 표시 유지

'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { AdminExam } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

export default function AdminExamsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', duration: 3600 });
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExams = () => {
    examsApi
      .getAllAdmin()
      .then(setExams)
      .catch(() => setError('시험 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadExams();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      await examsApi.create({
        title: createForm.title,
        description: createForm.description || undefined,
        duration: createForm.duration,
      });
      setShowCreateForm(false);
      setCreateForm({ title: '', description: '', duration: 3600 });
      loadExams();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
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
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setIsDeleting(false);
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
        <h1 className="text-2xl font-bold">시험 관리</h1>
        <Button onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? '취소' : '+ 시험 생성'}
        </Button>
      </div>

      {/* 안내 메시지 */}
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        💡 시험 생성 후 <strong>사용자 관리</strong> 페이지에서 사용자별로 시험을 할당하세요.
        할당된 사용자만 해당 시험을 응시할 수 있습니다.
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* 시험 생성 폼 */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5"
        >
          <h2 className="mb-4 font-semibold">새 시험 생성</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="시험 제목"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              required
            />
            <Input
              label="설명 (선택)"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">제한 시간</label>
              <div className="flex items-center gap-2">
                <select
                  value={createForm.duration}
                  onChange={(e) => setCreateForm({ ...createForm, duration: Number(e.target.value) })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1800}>30분</option>
                  <option value={3600}>60분</option>
                  <option value={5400}>90분</option>
                  <option value={7200}>120분</option>
                  <option value={0}>제한 없음</option>
                </select>
                <span className="text-sm text-gray-500">또는 직접 입력 (초 단위)</span>
                <input
                  type="number"
                  value={createForm.duration}
                  onChange={(e) => setCreateForm({ ...createForm, duration: Number(e.target.value) })}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
              </div>
            </div>
            <Button type="submit" isLoading={isCreating}>
              생성
            </Button>
          </div>
        </form>
      )}

      {/* 시험 목록 */}
      {exams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
          등록된 시험이 없습니다. 시험을 생성해주세요.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div>
                <h2 className="font-semibold text-gray-900">{exam.title}</h2>
                {exam.description && (
                  <p className="text-sm text-gray-400 line-clamp-1">{exam.description}</p>
                )}
                <p className="text-sm text-gray-500">
                  문제 {exam._count.questions}개 · 응시 {exam._count.submissions}회 ·{' '}
                  {exam.duration > 0 ? `${Math.floor(exam.duration / 60)}분` : '제한 없음'}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/exams/${exam.id}/questions`}>
                  <Button variant="secondary" size="sm">문제 관리</Button>
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTargetId(exam.id)}
                >
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
        title="시험을 삭제하시겠습니까?"
        message="삭제된 시험과 모든 응시 기록은 복구할 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
