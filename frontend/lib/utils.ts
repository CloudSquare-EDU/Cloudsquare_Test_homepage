// lib/utils.ts
// 공통 유틸리티 함수 모음 — 여러 페이지에서 재사용

// ── 시간 포맷 ──────────────────────────────────────────────────
export const formatDuration = (s: number): string => {
  if (s === 0) return '제한 없음';
  if (s < 3600) return `${Math.floor(s / 60)}분`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
};

// ── 점수 색상 ─────────────────────────────────────────────────
export const scoreColor = (score: number | null): string => {
  if (score === null) return 'text-[var(--text-muted)]';
  if (score >= 90) return 'text-[var(--success-text)]';
  if (score >= 60) return 'text-[var(--warning-text)]';
  return 'text-[var(--danger-text)]';
};

export const scoreBg = (score: number | null): string => {
  if (score === null) return 'bg-[var(--bg-raised)]';
  if (score >= 90) return 'bg-[var(--success-bg)]';
  if (score >= 60) return 'bg-[var(--bg-raised)]';
  return 'bg-[var(--danger-bg)]';
};

// ── 날짜 포맷 ─────────────────────────────────────────────────
export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
