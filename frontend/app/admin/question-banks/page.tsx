'use client';
// app/admin/question-banks/page.tsx
// 문제은행 관리 페이지
// 기능: 문제은행 CRUD + 엑셀 일괄 등록 + 문제 목록 확인/삭제

import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { questionBanksApi, BankQuestionInput, BulkImportResult } from '@/lib/api/questionBanks';
import { QuestionBankSummary, QuestionBankDetail } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';

// ── 엑셀 파싱 타입 ────────────────────────────────────────────
// 엑셀 컬럼 형식:
// 문제 | 선택지1 | 선택지2 | 선택지3 | 선택지4 | 선택지5 | 정답 (1~5 숫자 or 콤마 구분)
interface ExcelRow {
  문제: string;
  선택지1: string;
  선택지2: string;
  선택지3?: string;
  선택지4?: string;
  선택지5?: string;
  정답: string | number; // "1" or "1,3" (복수 정답)
}

const parseExcelRows = (rows: ExcelRow[]): { questions: BankQuestionInput[]; errors: { row: number; reason: string }[] } => {
  const questions: BankQuestionInput[] = [];
  const errors: { row: number; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    if (!row['문제']?.toString().trim()) {
      errors.push({ row: rowNum, reason: '문제 내용이 비어있습니다.' });
      return;
    }
    if (!row['선택지1']?.toString().trim() || !row['선택지2']?.toString().trim()) {
      errors.push({ row: rowNum, reason: '선택지1, 선택지2는 필수입니다.' });
      return;
    }

    const answerStr = row['정답']?.toString().trim() ?? '';
    if (!answerStr) {
      errors.push({ row: rowNum, reason: '정답이 비어있습니다.' });
      return;
    }

    const correctOrders = answerStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (correctOrders.length === 0) {
      errors.push({ row: rowNum, reason: '정답 형식이 잘못되었습니다. (예: 1 또는 1,3)' });
      return;
    }

    const rawChoices = [
      row['선택지1']?.toString().trim(),
      row['선택지2']?.toString().trim(),
      row['선택지3']?.toString().trim(),
      row['선택지4']?.toString().trim(),
      row['선택지5']?.toString().trim(),
    ].filter(Boolean) as string[];

    const choices = rawChoices.map((content, i) => ({
      content,
      isCorrect: correctOrders.includes(i + 1),
      order: i + 1,
    }));

    if (!choices.some((c) => c.isCorrect)) {
      errors.push({ row: rowNum, reason: `정답 번호(${answerStr})에 해당하는 선택지가 없습니다.` });
      return;
    }

    questions.push({ content: row['문제'].toString().trim(), choices });
  });

  return { questions, errors };
};

export default function QuestionBanksPage() {
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 선택된 문제은행 (우측 패널)
  const [selectedBank, setSelectedBank] = useState<QuestionBankDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // 문제은행 생성/수정 폼
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBankSummary | null>(null);
  const [bankForm, setBankForm] = useState({ name: '', description: '' });
  const [isSavingBank, setIsSavingBank] = useState(false);

  // 삭제
  const [deleteTarget, setDeleteTarget] = useState<QuestionBankSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 엑셀 업로드
  const [showImport, setShowImport] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [excelRows, setExcelRows] = useState<BankQuestionInput[]>([]);
  const [excelErrors, setExcelErrors] = useState<{ row: number; reason: string }[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 문제 삭제
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);

  const loadBanks = async () => {
    try {
      const data = await questionBanksApi.getAll();
      setBanks(data);
    } catch {
      setError('문제은행 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDetail = async (bankId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await questionBanksApi.getById(bankId);
      setSelectedBank(detail);
    } catch {
      setError('문제은행 상세 정보를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => { loadBanks(); }, []);

  // ── 문제은행 저장 ─────────────────────────────────────────────
  const handleSaveBank = async () => {
    if (!bankForm.name.trim()) return;
    setIsSavingBank(true);
    setError(null);
    try {
      if (editingBank) {
        await questionBanksApi.update(editingBank.id, bankForm.name, bankForm.description || undefined);
      } else {
        await questionBanksApi.create(bankForm.name, bankForm.description || undefined);
      }
      setShowBankForm(false);
      setEditingBank(null);
      setBankForm({ name: '', description: '' });
      await loadBanks();
      if (selectedBank) await loadDetail(selectedBank.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingBank(false);
    }
  };

  const openEdit = (bank: QuestionBankSummary) => {
    setEditingBank(bank);
    setBankForm({ name: bank.name, description: bank.description ?? '' });
    setShowBankForm(true);
  };

  // ── 문제은행 삭제 ─────────────────────────────────────────────
  const handleDeleteBank = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await questionBanksApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedBank?.id === deleteTarget.id) setSelectedBank(null);
      await loadBanks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── 엑셀 파싱 ────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelRows([]);
    setExcelErrors([]);
    setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws);
        if (rows.length === 0) { setExcelErrors([{ row: 0, reason: '데이터가 없습니다.' }]); return; }
        const { questions, errors } = parseExcelRows(rows);
        setExcelRows(questions);
        setExcelErrors(errors);
      } catch {
        setExcelErrors([{ row: 0, reason: '파일을 읽는 중 오류가 발생했습니다.' }]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── 일괄 등록 ────────────────────────────────────────────────
  const handleBulkImport = async () => {
    if (!selectedBank || excelRows.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const result = await questionBanksApi.bulkImport(selectedBank.id, excelRows, replaceMode);
      setImportResult(result);
      setExcelRows([]);
      if (fileRef.current) fileRef.current.value = '';
      await loadBanks();
      await loadDetail(selectedBank.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '등록 중 오류가 발생했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  // ── 문제 삭제 ────────────────────────────────────────────────
  const handleDeleteQuestion = async () => {
    if (!selectedBank || !deleteQuestionId) return;
    setIsDeletingQuestion(true);
    try {
      await questionBanksApi.deleteQuestion(selectedBank.id, deleteQuestionId);
      setDeleteQuestionId(null);
      await loadBanks();
      await loadDetail(selectedBank.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '문제 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingQuestion(false);
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
    <div className="flex h-full gap-5">
      {/* ── 좌측: 문제은행 목록 ─────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">문제은행</h1>
          <Button size="sm" onClick={() => { setEditingBank(null); setBankForm({ name: '', description: '' }); setShowBankForm(true); }}>
            + 신규
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
            {error}
          </div>
        )}

        {/* 생성/수정 폼 */}
        {showBankForm && (
          <div className="rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-4">
            <p className="mb-3 text-xs font-semibold text-[var(--text-secondary)]">
              {editingBank ? '문제은행 수정' : '새 문제은행'}
            </p>
            <Input
              label="이름"
              value={bankForm.name}
              onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
              placeholder="예: 소버린AI 과정 문제풀"
              autoFocus
            />
            <div className="mt-2">
              <Input
                label="설명 (선택)"
                value={bankForm.description}
                onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })}
                placeholder="간단한 설명"
              />
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowBankForm(false)}>취소</Button>
              <Button size="sm" isLoading={isSavingBank} onClick={handleSaveBank}>저장</Button>
            </div>
          </div>
        )}

        {banks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--text-muted)]">
            문제은행이 없습니다
          </div>
        ) : (
          banks.map((bank) => (
            <div
              key={bank.id}
              onClick={() => loadDetail(bank.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                selectedBank?.id === bank.id
                  ? 'border-[#5e6ad2] bg-[rgba(94,106,210,0.08)]'
                  : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">{bank.name}</p>
                  {bank.description && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">{bank.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--text-faint)]">
                    <span className="rounded bg-[var(--bg-raised)] px-1.5 py-0.5">문제 {bank._count.questions}개</span>
                    <span className="rounded bg-[var(--bg-raised)] px-1.5 py-0.5">시험 {bank._count.exams}개</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEdit(bank)}
                    className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-secondary)] transition-colors"
                    title="수정"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(bank)}
                    className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] transition-colors"
                    title="삭제"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 4h10M6 4V2h4v2M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── 우측: 선택된 문제은행 상세 ──────────────────────────── */}
      <div className="flex-1 min-w-0">
        {!selectedBank ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            좌측에서 문제은행을 선택하세요
          </div>
        ) : isLoadingDetail ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{selectedBank.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  문제 {selectedBank._count.questions}개 등록됨
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setShowImport((v) => !v); setImportResult(null); setExcelRows([]); setExcelErrors([]); }}
              >
                {showImport ? '닫기' : '📥 엑셀 일괄 등록'}
              </Button>
            </div>

            {/* 엑셀 등록 패널 */}
            {showImport && (
              <div className="rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
                <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">엑셀 일괄 등록</h3>
                <p className="mb-3 text-xs text-[var(--text-muted)]">
                  첫 번째 시트 기준으로 파싱합니다.
                </p>

                {/* 컬럼 형식 안내 */}
                <div className="mb-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-[11px]">
                  <p className="mb-2 font-medium text-[var(--text-secondary)]">엑셀 컬럼 형식</p>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)]">
                        {['문제', '선택지1', '선택지2', '선택지3', '선택지4', '선택지5', '정답'].map((h) => (
                          <th key={h} className="pb-1.5 pr-3 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-[var(--text-muted)]">
                        <td className="pt-1.5 pr-3 whitespace-nowrap">다음 중 올바른 것은?</td>
                        <td className="pt-1.5 pr-3">보기1</td>
                        <td className="pt-1.5 pr-3">보기2</td>
                        <td className="pt-1.5 pr-3">보기3</td>
                        <td className="pt-1.5 pr-3">보기4</td>
                        <td className="pt-1.5 pr-3">-</td>
                        <td className="pt-1.5 pr-3 text-[#5e6ad2] font-medium">2</td>
                      </tr>
                      <tr className="text-[var(--text-muted)]">
                        <td className="pt-1.5 pr-3 whitespace-nowrap">복수 정답 문제</td>
                        <td className="pt-1.5 pr-3">보기1</td>
                        <td className="pt-1.5 pr-3">보기2</td>
                        <td className="pt-1.5 pr-3">보기3</td>
                        <td className="pt-1.5 pr-3">-</td>
                        <td className="pt-1.5 pr-3">-</td>
                        <td className="pt-1.5 pr-3 text-[#5e6ad2] font-medium">1,3</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-[var(--text-faint)]">• 선택지3~5는 비워도 됩니다. 정답은 선택지 번호(1~5), 복수 정답은 콤마로 구분.</p>
                </div>

                {/* 파일 업로드 */}
                <div className="mb-3 flex items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="block text-xs text-[var(--text-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[#5e6ad2] file:px-3 file:py-1.5 file:text-white file:text-xs file:cursor-pointer hover:file:bg-[#6b78e5]"
                  />
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={replaceMode}
                      onChange={(e) => setReplaceMode(e.target.checked)}
                      className="accent-[#5e6ad2]"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">기존 문제 전체 교체</span>
                  </label>
                </div>

                {/* 파싱 오류 */}
                {excelErrors.length > 0 && (
                  <div className="mb-3 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs">
                    <p className="font-medium text-[var(--danger-text)] mb-1">{excelErrors.length}개 행에서 오류 발견</p>
                    {excelErrors.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-[var(--danger-text)]">• {e.row > 0 ? `${e.row}행:` : ''} {e.reason}</p>
                    ))}
                    {excelErrors.length > 5 && (
                      <p className="text-[var(--danger-text)]">...외 {excelErrors.length - 5}개</p>
                    )}
                  </div>
                )}

                {/* 등록 결과 */}
                {importResult && (
                  <div className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-xs">
                    <p className="font-medium text-[var(--success-text)]">
                      {importResult.success}문제 등록 완료
                      {importResult.failed.length > 0 && ` / ${importResult.failed.length}문제 실패`}
                    </p>
                    {importResult.failed.slice(0, 3).map((f, i) => (
                      <p key={i} className="text-[var(--danger-text)]">• {f.row}행: {f.reason}</p>
                    ))}
                  </div>
                )}

                {/* 미리보기 + 등록 버튼 */}
                {excelRows.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {excelRows.length}문제 파싱 완료
                      {replaceMode && <span className="ml-1.5 text-[var(--warning-text)]">(기존 문제 전체 교체됨)</span>}
                    </p>
                    <Button size="sm" isLoading={isImporting} onClick={handleBulkImport}>
                      {excelRows.length}문제 등록
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 문제 목록 */}
            {selectedBank.questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
                <p className="text-sm text-[var(--text-muted)]">등록된 문제가 없습니다</p>
                <p className="mt-1 text-xs text-[var(--text-faint)]">엑셀 일괄 등록으로 문제를 추가하세요</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto">
                {selectedBank.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4 hover:border-[var(--border-hover)] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-[var(--bg-raised)] text-[#5e6ad2]">
                        Q{idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{q.content}</p>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {q.choices.map((c) => (
                            <div
                              key={c.id}
                              className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs ${
                                c.isCorrect
                                  ? 'bg-[rgba(94,106,210,0.1)] text-[#5e6ad2] border border-[rgba(94,106,210,0.25)]'
                                  : 'bg-[var(--bg-inset)] text-[var(--text-muted)]'
                              }`}
                            >
                              <span className="shrink-0 font-mono text-[10px]">{c.order}.</span>
                              <span className="truncate">{c.content}</span>
                              {c.isCorrect && <span className="ml-auto shrink-0 text-[10px]">✓</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setDeleteQuestionId(q.id)}
                        className="shrink-0 rounded p-1 text-[var(--text-faint)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] transition-colors"
                        title="문제 삭제"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 4h10M6 4V2h4v2M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 - 문제은행 */}
      <Modal
        isOpen={!!deleteTarget}
        title="문제은행을 삭제하시겠습니까?"
        message={`"${deleteTarget?.name}" 및 포함된 모든 문제가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDeleteBank}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />

      {/* 삭제 확인 모달 - 문제 */}
      <Modal
        isOpen={!!deleteQuestionId}
        title="문제를 삭제하시겠습니까?"
        message="이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDeleteQuestion}
        onCancel={() => setDeleteQuestionId(null)}
        isLoading={isDeletingQuestion}
      />
    </div>
  );
}
