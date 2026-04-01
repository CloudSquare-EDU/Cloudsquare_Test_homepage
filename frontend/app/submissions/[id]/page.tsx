// app/submissions/[id]/page.tsx
// 역할: 응시 결과 상세 페이지 — 점수, 정오표 표시
// 수정 이력:
//   - 복수 정답(선다형) 지원: Answer 레코드가 선택지 수만큼 존재하므로
//     questionId 기준으로 그룹핑 후 문제당 1개 카드로 표시
//   - 정답 수 계산도 개별 레코드가 아닌 문제 단위로 집계

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { submissionsApi } from '@/lib/api/submissions';
import { SubmissionDetail } from '@/lib/types';
import { Button } from '@/components/ui/Button';

// 문제별로 Answer 레코드를 묶은 그룹 타입
interface AnswerGroup {
  questionId: string;
  isCorrect: boolean;
  question: SubmissionDetail['answers'][number]['question'];
  selectedChoiceIds: Set<string>; // 사용자가 선택한 선택지 ID 집합
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    submissionsApi
      .getById(id)
      .then(setSubmission)
      .catch(() => setError('결과를 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">결과 로딩 중...</p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        {error ?? '결과를 찾을 수 없습니다.'}
      </div>
    );
  }

  // ── questionId 기준으로 Answer 레코드 그룹핑 ──────────────────
  // 복수 정답 문제는 선택지마다 Answer 레코드가 1개씩 있으므로 묶어야 함
  const groupMap = new Map<string, AnswerGroup>();
  for (const answer of submission.answers) {
    const existing = groupMap.get(answer.questionId);
    if (existing) {
      existing.selectedChoiceIds.add(answer.choice.id);
    } else {
      groupMap.set(answer.questionId, {
        questionId: answer.questionId,
        isCorrect: answer.isCorrect,
        question: answer.question,
        selectedChoiceIds: new Set([answer.choice.id]),
      });
    }
  }
  // question.order 순서로 정렬
  const answerGroups = Array.from(groupMap.values()).sort(
    (a, b) => (a.question as { order?: number }).order ?? 0 - ((b.question as { order?: number }).order ?? 0),
  );

  // 정답 수: 문제 단위로 집계 (레코드 수가 아님)
  const correctCount = answerGroups.filter((g) => g.isCorrect).length;
  const percentage =
    submission.score ?? Math.round((correctCount / submission.totalQuestions) * 100);

  return (
    <div>
      {/* 결과 요약 카드 */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-white shadow-lg">
        <h1 className="mb-1 text-xl font-semibold">{submission.exam.title}</h1>
        <p className="mb-6 text-blue-200 text-sm">
          {new Date(submission.submittedAt).toLocaleString('ko-KR')} 제출
        </p>
        <div className="flex items-end gap-2">
          <span className="text-6xl font-black">{percentage}</span>
          <span className="mb-2 text-2xl font-semibold">점</span>
        </div>
        <p className="mt-2 text-blue-200">
          {correctCount}문제 정답 / 총 {submission.totalQuestions}문제
        </p>
      </div>

      {/* 정오표 */}
      <h2 className="mb-4 text-lg font-bold">문제별 결과</h2>
      <div className="flex flex-col gap-4">
        {answerGroups.map((group, idx) => {
          const isMulti = group.question.choices.filter((c) => c.isCorrect).length > 1;

          return (
            <div
              key={group.questionId}
              className={`rounded-xl border p-5 ${
                group.isCorrect
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              {/* 문제 헤더 */}
              <div className="mb-3 flex items-start gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    group.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                  }`}
                >
                  {group.isCorrect ? '정답' : '오답'}
                </span>
                {isMulti && (
                  <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    복수 정답
                  </span>
                )}
                <p className="font-medium text-gray-900">
                  Q{idx + 1}. {group.question.content}
                </p>
              </div>

              {/* 선택지 목록 */}
              <div className="flex flex-col gap-1.5 pl-4">
                {group.question.choices.map((choice) => {
                  const isMyAnswer = group.selectedChoiceIds.has(choice.id);
                  const isCorrectAnswer = choice.isCorrect;

                  let className = 'text-sm text-gray-600';
                  let suffix = '';

                  if (isCorrectAnswer && isMyAnswer) {
                    // 정답이고 내가 선택한 것
                    className = 'text-sm font-semibold text-green-700';
                    suffix = ' ✓';
                  } else if (isCorrectAnswer && !isMyAnswer) {
                    // 정답인데 내가 선택 안 한 것 (오답 처리된 경우에만 표시)
                    className = 'text-sm font-semibold text-green-700';
                    suffix = ' ✓ (정답)';
                  } else if (!isCorrectAnswer && isMyAnswer) {
                    // 오답인데 내가 선택한 것
                    className = 'text-sm text-red-600 line-through';
                    suffix = ' (내 답)';
                  }

                  return (
                    <p key={choice.id} className={className}>
                      {choice.order}. {choice.content}
                      {suffix}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Link href="/">
          <Button variant="secondary">시험 목록으로</Button>
        </Link>
        <Link href="/submissions">
          <Button>내 기록 보기</Button>
        </Link>
      </div>
    </div>
  );
}
