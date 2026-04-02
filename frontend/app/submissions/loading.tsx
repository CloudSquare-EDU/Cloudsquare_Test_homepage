// app/submissions/loading.tsx
// 응시 기록 페이지 로딩 스켈레톤

export default function SubmissionsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-[var(--bg-raised)]" />
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--bg-raised)]" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4"
          >
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-[var(--bg-raised)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--bg-raised)]" />
              <div className="h-3 w-32 animate-pulse rounded bg-[var(--bg-raised)]" />
            </div>
            <div className="h-8 w-20 animate-pulse rounded bg-[var(--bg-raised)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
