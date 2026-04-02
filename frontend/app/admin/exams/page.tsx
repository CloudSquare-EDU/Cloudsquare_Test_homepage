// app/admin/exams/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { AdminExam } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

const formatDuration = (s: number) => {
  if (s === 0) return '제한 없음';
  if (s < 3600) return `${Math.floor(s / 60)}분`;
  return `${Math.floor(s / 3600)}시간`;
};

export default function AdminExamsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', duration: 3600 });
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExams = () => {
    examsApi.getAllAdmin()
      .then(setExams)
      .catch(() => setError('시험 목록을 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadExams(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      await examsApi.create({ title: form.title, description: form.description || undefined, duration: form.duration });
      setShowCreate(false);
      setForm({ title: '', description: '', duration: 3600 });
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

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#ededf0]">시험 관리</h1>
          <p className="mt-0.5 text-sm text-[#55556a]">
            시험 생성 후 사용자 관리에서 개별 할당하세요
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} size="sm">
          {showCreate ? '취소' : '+ 시험 생성'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[rgba(248,113,113,0.2)] bg-[#250d0d] px-3 py-2.5 text-xs text-[#f87171]">
          {error}
        </div>
      )}

      {/* 시험 생성 폼 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-5 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[#18181f] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[#ededf0]">새 시험 생성</h2>
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
              <label className="text-xs font-medium text-[#9090aa]">제한 시간</label>
              <div className="flex items-center gap-2">
                <select
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="h-8 rounded-md border border-[rgba(255,255,255,0.09)] bg-[#18181f] px-2 text-sm text-[#ededf0] focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value={1800}>30분</option>
                  <option value={3600}>60분</option>
                  <option value={5400}>90분</option>
                  <option value={7200}>120분</option>
                  <option value={0}>제한 없음</option>
                </select>
                <span className="text-xs text-[#44445a]">또는 직접 입력 (초)</span>
                <input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="h-8 w-24 rounded-md border border-[rgba(255,255,255,0.09)] bg-[#18181f] px-2 text-sm text-[#ededf0] focus:outline-none focus:border-[#5e6ad2]"
                  min={0}
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" isLoading={isCreating} size="sm">생성</Button>
            </div>
          </div>
        </form>
      )}

      {/* 시험 목록 */}
      {exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] py-16 text-center">
          <p className="text-sm text-[#55556a]">등록된 시험이 없습니다</p>
          <p className="mt-1 text-xs text-[#44445a]">위 버튼으로 시험을 생성하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center gap-4 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#18181f] px-5 py-4 hover:border-[rgba(255,255,255,0.12)] transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1e1e2e] text-[#5e6ad2]">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                  <path d="M10 2v3h3M5 8h6M5 11h4" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#ededf0] truncate">{exam.title}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-[#55556a]">
                  <span>문제 {exam._count.questions}개</span>
                  <span>·</span>
                  <span>응시 {exam._count.submissions}회</span>
                  <span>·</span>
                  <span>{formatDuration(exam.duration)}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
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
    </div>
  );
}
