// lib/utils.ts
// 공통 유틸리티 함수 모음 — 여러 페이지에서 재사용
import * as XLSX from 'xlsx';

// ── 엑셀 샘플 다운로드 ─────────────────────────────────────────
// rows: 데이터 행 배열 (헤더 포함)
// sheetName: 시트 이름
// fileName: 다운로드 파일명 (.xlsx 자동 붙음)
export const downloadSampleExcel = (
  rows: (string | number)[][],
  sheetName: string,
  fileName: string,
): void => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

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

// ── datetime-local input 값 변환 ───────────────────────────────
// <input type="datetime-local">은 "로컬(브라우저 시간대) 벽시계 시각" 문자열을 주고받는다.
// 서버에서 받은 ISO 문자열(UTC)을 그냥 new Date(iso).toISOString().slice(0,16)로 자르면
// UTC 시각이 그대로 로컬 시각인 것처럼 표시되어 시간대 차이(한국은 9시간)만큼 과거로 보이고,
// 그 값을 그대로 다시 저장하면 실제 시각이 시간대만큼 어긋나버린다. 반드시 이 함수로 변환해서 채울 것.
export const toDatetimeLocalValue = (dateStr: string): string => {
  const d = new Date(dateStr);
  const localMs = d.getTime() - d.getTimezoneOffset() * 60000;
  return new Date(localMs).toISOString().slice(0, 16);
};
