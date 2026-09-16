// app/submissions/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { submissionsApi } from '@/lib/api/submissions';
import { SubmissionDetail } from '@/lib/types';
import { Button } from '@/components/ui/Button';

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
      <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
        {error ?? '결과를 찾을 수 없습니다.'}
      </div>
    );
  }

  const { questionResults, score, totalQuestions, submittedAt, exam, resultHidden } = submission;

  // 실제시험(REAL_EXAM): 운영진만 결과를 확인할 수 있으므로 점수/정오표 대신 안내만 표시
  if (resultHidden) {
    return (
      <div>
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--text-muted)] mb-1">
              {new Date(submittedAt).toLocaleString('ko-KR')} 제출
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] break-words">{exam.title}</h1>
          </div>
          <Link href="/submissions" className="shrink-0">
            <Button variant="ghost" size="sm">← 기록 목록</Button>
          </Link>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-raised)] text-2xl">🔒</div>
          <p className="text-base font-semibold text-[var(--text-primary)]">제출이 완료되었습니다</p>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">
            이 시험은 실제 시험으로, 점수와 정오표는 운영진만 확인할 수 있습니다.
          </p>
          <p className="mt-3 text-xs text-[var(--text-faint)]">총 {totalQuestions}문제 제출됨</p>
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

  const correctCount = questionResults.filter((q) => q.isCorrect).length;
  const unansweredCount = questionResults.filter((q) => q.isAnswered === false).length;
  const wrongCount = totalQuestions - correctCount - unansweredCount;
  const finalScore = score ?? Math.round((correctCount / totalQuestions) * 100);
  const scoreColor =
    finalScore >= 80
      ? 'text-[var(--success-text)]'
      : finalScore >= 60
      ? 'text-[var(--warning-text)]'
      : 'text-[var(--danger-text)]';

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--text-muted)] mb-1">
            {new Date(submittedAt).toLocaleString('ko-KR')} 제출
          </p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] break-words">{exam.title}</h1>
        </div>
        <Link href="/submissions" className="shrink-0">
          <Button variant="ghost" size="sm">← 기록 목록</Button>
        </Link>
      </div>

      {/* 점수 요약 */}
      <div className="mb-6 flex items-center gap-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-5">
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1">최종 점수</p>
          <p className={`text-5xl font-black ${scoreColor}`}>
            {finalScore}
            <span className="text-xl font-normal text-[var(--text-muted)]">점</span>
          </p>
        </div>
        <div className="h-12 w-px bg-[var(--border)]" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[var(--text-primary)]">정답 {correctCount}문제</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[var(--text-secondary)]">오답 {wrongCount}문제</span>
          </div>
          {unansweredCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              <span className="text-[var(--text-faint)]">미응답 {unansweredCount}문제</span>
            </div>
          )}
          <div className="text-xs text-[var(--text-muted)]">총 {totalQuestions}문제</div>
        </div>
      </div>

      {/* 정답 검수 관련 안내 */}
      <div className="mb-6 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-xs leading-relaxed text-[var(--warning-text)]">
        ⚠ 이 시험 문제는 문제은행에서 무작위로 출제되며, 아직 정답에 대한 전수 검수가 완료되지 않았습니다. 일부 문제는 정답이 잘못 등록되었거나, 네이버클라우드 서비스 사양 변경으로 최신 정답과 달라졌을 수 있습니다.
        실제 자격시험을 준비하실 때는 여기 표시된 정답을 그대로 믿지 마시고 <span className="font-medium">반드시 본인이 직접 정답을 검수</span>하시고, 헷갈리는 문제는{' '}
        <a
          href="https://api.ncloud-docs.com/docs/home"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:opacity-80"
        >
          네이버클라우드 API 문서
        </a>
        를 참고해 확인해 주세요.
      </div>

      {/* 정오표 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">문제별 결과</h2>
        <span className="hidden sm:inline text-xs text-[var(--text-faint)]">— 정답은 ✓, 내가 선택한 오답은 취소선</span>
      </div>
      <div className="flex flex-col gap-2">
        {questionResults.map((qr, idx) => {
          const isMulti = qr.choices.filter((c) => c.isCorrect).length > 1;
          const isUnanswered = qr.isAnswered === false;
          return (
            <div
              key={qr.key}
              className={`rounded-lg border px-4 py-4 ${
                isUnanswered
                  ? 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  : qr.isCorrect
                  ? 'border-[var(--success-border)] bg-[var(--success-bg)]'
                  : 'border-[rgba(248,113,113,0.15)] bg-[var(--danger-bg)]'
              }`}
            >
              <div className="mb-3 flex items-start gap-2">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    isUnanswered
                      ? 'bg-[var(--bg-raised)] text-[var(--text-faint)]'
                      : qr.isCorrect
                      ? 'bg-green-900/50 text-[var(--success-text)]'
                      : 'bg-red-900/50 text-[var(--danger-text)]'
                  }`}
                >
                  {isUnanswered ? '미응답' : qr.isCorrect ? '정답' : '오답'}
                </span>
                {isMulti && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[var(--bg-raised)] text-[#8090d8]">
                    복수정답
                  </span>
                )}
                <p className="text-sm font-medium text-[var(--text-primary)] break-words">
                  Q{idx + 1}. {qr.content}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 pl-4">
                {qr.choices.map((choice) => {
                  let cls = 'text-sm text-[var(--text-muted)]';
                  let suffix = '';
                  if (choice.isCorrect && choice.isSelected) {
                    cls = 'text-sm font-medium text-[var(--success-text)]';
                    suffix = ' ✓';
                  } else if (choice.isCorrect && !choice.isSelected) {
                    cls = 'text-sm font-medium text-green-600';
                    suffix = isUnanswered ? ' ✓ (정답)' : ' ✓ (정답)';
                  } else if (!choice.isCorrect && choice.isSelected) {
                    cls = 'text-sm text-red-500 line-through';
                    suffix = ' ✗';
                  }
                  return (
                    <p key={choice.id} className={cls}>
                      {choice.content}{suffix}
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
