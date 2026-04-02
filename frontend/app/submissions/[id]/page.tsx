// app/submissions/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { submissionsApi } from '@/lib/api/submissions';
import { SubmissionDetail } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface AnswerGroup {
  questionId: string;
  isCorrect: boolean;
  question: SubmissionDetail['answers'][number]['question'];
  selectedChoiceIds: Set<string>;
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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="rounded-md border border-[rgba(248,113,113,0.2)] bg-[#250d0d] p-3 text-sm text-[#f87171]">
        {error ?? '결과를 찾을 수 없습니다.'}
      </div>
    );
  }

  // questionId 기준으로 그룹핑
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
  const answerGroups = Array.from(groupMap.values());
  const correctCount = answerGroups.filter((g) => g.isCorrect).length;
  const score = submission.score ?? Math.round((correctCount / submission.totalQuestions) * 100);

  const scoreColor =
    score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#55556a] mb-1">
            {new Date(submission.submittedAt).toLocaleString('ko-KR')} 제출
          </p>
          <h1 className="text-xl font-semibold text-[#ededf0]">{submission.exam.title}</h1>
        </div>
        <Link href="/submissions">
          <Button variant="ghost" size="sm">← 기록 목록</Button>
        </Link>
      </div>

      {/* 점수 요약 */}
      <div className="mb-6 flex items-center gap-6 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181f] px-6 py-5">
        <div>
          <p className="text-xs text-[#55556a] mb-1">최종 점수</p>
          <p className={`text-5xl font-black ${scoreColor}`}>{score}<span className="text-xl font-normal text-[#55556a]">점</span></p>
        </div>
        <div className="h-12 w-px bg-[rgba(255,255,255,0.07)]" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[#ededf0]">정답 {correctCount}문제</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[#9090aa]">오답 {submission.totalQuestions - correctCount}문제</span>
          </div>
          <div className="text-xs text-[#55556a]">총 {submission.totalQuestions}문제</div>
        </div>
      </div>

      {/* 정오표 */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[#ededf0]">문제별 결과</h2>
        <span className="text-xs text-[#44445a]">— 정답은 ✓, 내가 선택한 오답은 취소선</span>
      </div>
      <div className="flex flex-col gap-2">
        {answerGroups.map((group, idx) => {
          const isMulti = group.question.choices.filter((c) => c.isCorrect).length > 1;
          return (
            <div
              key={group.questionId}
              className={`rounded-lg border px-4 py-4 ${
                group.isCorrect
                  ? 'border-[rgba(74,222,128,0.15)] bg-[#0f2318]'
                  : 'border-[rgba(248,113,113,0.15)] bg-[#250d0d]'
              }`}
            >
              <div className="mb-3 flex items-start gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  group.isCorrect ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {group.isCorrect ? '정답' : '오답'}
                </span>
                {isMulti && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[#1e1e2e] text-[#8090d8]">
                    복수정답
                  </span>
                )}
                <p className="text-sm font-medium text-[#ededf0]">
                  Q{idx + 1}. {group.question.content}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 pl-4">
                {group.question.choices.map((choice) => {
                  const isMine = group.selectedChoiceIds.has(choice.id);
                  const isRight = choice.isCorrect;

                  let cls = 'text-sm text-[#55556a]';
                  let suffix = '';
                  if (isRight && isMine) { cls = 'text-sm font-medium text-green-400'; suffix = ' ✓'; }
                  else if (isRight && !isMine) { cls = 'text-sm font-medium text-green-600'; suffix = ' ✓ (정답)'; }
                  else if (!isRight && isMine) { cls = 'text-sm text-red-500 line-through'; suffix = ' ✗'; }

                  return (
                    <p key={choice.id} className={cls}>
                      {choice.order}. {choice.content}{suffix}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link href="/">
          <Button variant="secondary">시험 목록</Button>
        </Link>
        <Link href="/submissions">
          <Button variant="ghost">내 기록 보기</Button>
        </Link>
      </div>
    </div>
  );
}
