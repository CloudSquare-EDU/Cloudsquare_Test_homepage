// app/admin/exams/[id]/questions/page.tsx
// 역할: 관리자 문제 관리 페이지 — 특정 시험의 문제 목록 조회, 문제 추가, 삭제

'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { examsApi } from '@/lib/api/exams';
import { questionsApi } from '@/lib/api/questions';
import { ExamDetail, Question } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

interface ChoiceForm {
  content: string;
  isCorrect: boolean;
  order: number;
}

const DEFAULT_CHOICES: ChoiceForm[] = [
  { content: '', isCorrect: false, order: 1 },
  { content: '', isCorrect: false, order: 2 },
  { content: '', isCorrect: false, order: 3 },
  { content: '', isCorrect: false, order: 4 },
];

export default function AdminQuestionsPage() {
  const { id: examId } = useParams<{ id: string }>();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [questionContent, setQuestionContent] = useState('');
  const [choices, setChoices] = useState<ChoiceForm[]>(DEFAULT_CHOICES);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExam = () => {
    examsApi
      .getById(examId)
      .then(setExam)
      .catch(() => setError('시험 정보를 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadExam();
  }, [examId]);

  const handleChoiceChange = (index: number, value: string) => {
    setChoices((prev) => prev.map((c, i) => (i === index ? { ...c, content: value } : c)));
  };

  const handleCorrectSelect = (index: number) => {
    setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === index })));
  };

  const handleAddQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!exam) return;

    const correctSelected = choices.some((c) => c.isCorrect);
    if (!correctSelected) {
      setError('정답을 선택해주세요.');
      return;
    }
    if (choices.some((c) => !c.content.trim())) {
      setError('모든 선택지를 입력해주세요.');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      await questionsApi.create({
        examId,
        content: questionContent,
        order: (exam.questions?.length ?? 0) + 1,
        choices,
      });
      setQuestionContent('');
      setChoices(DEFAULT_CHOICES);
      setShowAddForm(false);
      loadExam();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await questionsApi.delete(deleteTargetId);
      setDeleteTargetId(null);
      loadExam();
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
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/exams" className="hover:underline">시험 관리</Link>
        <span>›</span>
        <span>{exam?.title}</span>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">문제 관리</h1>
        <Button onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? '취소' : '+ 문제 추가'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* 문제 추가 폼 */}
      {showAddForm && (
        <form
          onSubmit={handleAddQuestion}
          className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5"
        >
          <h2 className="mb-4 font-semibold">새 문제 추가</h2>
          <div className="mb-4">
            <Input
              label="문제 내용"
              value={questionContent}
              onChange={(e) => setQuestionContent(e.target.value)}
              required
            />
          </div>
          <p className="mb-2 text-sm font-medium text-gray-700">선택지 (라디오 버튼으로 정답 선택)</p>
          <div className="flex flex-col gap-2 mb-4">
            {choices.map((choice, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={choice.isCorrect}
                  onChange={() => handleCorrectSelect(idx)}
                  className="h-4 w-4 text-blue-600"
                />
                <input
                  type="text"
                  value={choice.content}
                  onChange={(e) => handleChoiceChange(idx, e.target.value)}
                  placeholder={`선택지 ${idx + 1}`}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {choice.isCorrect && (
                  <span className="text-xs text-green-600 font-medium">정답</span>
                )}
              </div>
            ))}
          </div>
          <Button type="submit" isLoading={isAdding}>
            문제 추가
          </Button>
        </form>
      )}

      {/* 문제 목록 */}
      {!exam?.questions?.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
          등록된 문제가 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exam.questions.map((q: Question, idx) => (
            <div
              key={q.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    <span className="mr-2 text-blue-600">Q{idx + 1}.</span>
                    {q.content}
                  </p>
                  <div className="mt-2 flex flex-col gap-1 pl-6">
                    {q.choices.map((c) => (
                      <p key={c.id} className="text-sm text-gray-600">
                        {c.order}. {c.content}
                      </p>
                    ))}
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTargetId(q.id)}
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
        title="문제를 삭제하시겠습니까?"
        message="삭제된 문제는 복구할 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDeleteQuestion}
        onCancel={() => setDeleteTargetId(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
