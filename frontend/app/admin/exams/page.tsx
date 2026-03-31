// app/admin/exams/page.tsx
// 역할: 관리자 시험 목록 — 생성, 공개, 삭제 기능

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

  const handlePublish = async (id: string) => {
    try {
      await examsApi.publish(id);
      loadExams();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
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
            <Input
              label="제한 시간 (초)"
              type="number"
              value={createForm.duration}
              onChange={(e) =>
                setCreateForm({ ...createForm, duration: Number(e.target.value) })
              }
              required
            />
            <Button type="submit" isLoading={isCreating}>
              생성
            </Button>
          </div>
        </form>
      )}

      {/* 시험 목록 */}
      <div className="flex flex-col gap-3">
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{exam.title}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    exam.isPublished
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {exam.isPublished ? '공개' : '비공개'}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                문제 {exam._count.questions}개 · 응시 {exam._count.submissions}회 ·{' '}
                {Math.floor(exam.duration / 60)}분
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/exams/${exam.id}/questions`}>
                <Button variant="secondary" size="sm">문제 관리</Button>
              </Link>
              {!exam.isPublished && (
                <Button size="sm" onClick={() => handlePublish(exam.id)}>
                  공개
                </Button>
              )}
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
