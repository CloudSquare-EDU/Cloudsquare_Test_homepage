// components/ui/Pagination.tsx
// 역할: 범용 페이지네이션 UI — 이전/다음/번호 버튼

'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ page, totalPages, total, limit, onPageChange }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  // 표시할 페이지 번호 목록 (최대 5개, 현재 페이지 중심)
  const getPageNumbers = () => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | '...')[] = [];

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) rangeWithDots.push(1, '...');
    else rangeWithDots.push(1);

    rangeWithDots.push(...range);

    if (page + delta < totalPages - 1) rangeWithDots.push('...', totalPages);
    else if (totalPages > 1) rangeWithDots.push(totalPages);

    return rangeWithDots;
  };

  const btnBase =
    'flex h-7 min-w-[28px] items-center justify-center rounded px-2 text-sm transition-colors';
  const btnActive =
    'bg-[#5e6ad2] text-white font-medium';
  const btnInactive =
    'text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]';
  const btnDisabled =
    'text-[var(--text-faint)] cursor-not-allowed';

  return (
    <div className="flex flex-col items-center gap-2 px-5 py-3 sm:flex-row sm:justify-between border-t border-[var(--border-subtle)]">
      {/* 건수 표시 */}
      <p className="text-xs text-[var(--text-faint)]">
        전체 {total}개 중 {start}–{end}
      </p>

      {/* 페이지 버튼 */}
      <div className="flex items-center gap-1">
        {/* 이전 */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
          aria-label="이전 페이지"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* 번호 */}
        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-sm text-[var(--text-faint)]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
            >
              {p}
            </button>
          )
        )}

        {/* 다음 */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
          aria-label="다음 페이지"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};
