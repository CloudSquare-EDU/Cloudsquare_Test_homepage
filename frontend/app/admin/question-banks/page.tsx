'use client';
// app/admin/question-banks/page.tsx
// 문제은행 관리 페이지 — 과정 관리와 동일한 단일 컬럼 레이아웃

import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { questionBanksApi, BankQuestionInput, BulkImportResult } from '@/lib/api/questionBanks';
import { QuestionBankSummary, QuestionBankDetail } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';
import { downloadSampleExcel } from '@/lib/utils';

const handleDownloadQuestionSample = () => {
  downloadSampleExcel(
    [
      ['문제', '선택지1', '선택지2', '선택지3', '선택지4', '선택지5', '정답'],
      ['다음 중 클라우드 컴퓨팅의 특징으로 올바른 것은?', '온디맨드 셀프서비스', '물리 서버 전용 사용', '고정된 용량', '단일 위치 배포', '', '1'],
      ['IaaS에 해당하는 서비스는?', 'Google Docs', 'AWS EC2', 'Salesforce', 'Gmail', '', '2'],
      ['복수 정답 문제 예시 — 올바른 것을 모두 고르시오', '탄력적 확장', '종량제 과금', '고정 비용', '글로벌 배포', '', '1,2,4'],
    ],
    '문제목록',
    '문제은행_샘플',
  );
};

interface ExcelRow {
  문제: string;
  선택지1: string;
  선택지2: string;
  선택지3?: string;
  선택지4?: string;
  선택지5?: string;
  정답: string | number;
}

const parseExcelRows = (rows: ExcelRow[]): { questions: BankQuestionInput[]; errors: { row: number; reason: string }[] } => {
  const questions: BankQuestionInput[] = [];
  const errors: { row: number; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    if (!row['문제']?.toString().trim()) { errors.push({ row: rowNum, reason: '문제 내용이 비어있습니다.' }); return; }
    if (!row['선택지1']?.toString().trim() || !row['선택지2']?.toString().trim()) { errors.push({ row: rowNum, reason: '선택지1, 선택지2는 필수입니다.' }); return; }
    const answerStr = row['정답']?.toString().trim() ?? '';
    if (!answerStr) { errors.push({ row: rowNum, reason: '정답이 비어있습니다.' }); return; }
    const correctOrders = answerStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (correctOrders.length === 0) { errors.push({ row: rowNum, reason: '정답 형식이 잘못되었습니다. (예: 1 또는 1,3)' }); return; }
    const rawChoices = [row['선택지1'], row['선택지2'], row['선택지3'], row['선택지4'], row['선택지5']]
      .map((v) => v?.toString().trim())
      .filter(Boolean) as string[];
    const choices = rawChoices.map((content, i) => ({ content, isCorrect: correctOrders.includes(i + 1), order: i + 1 }));
    if (!choices.some((c) => c.isCorrect)) { errors.push({ row: rowNum, reason: `정답 번호(${answerStr})에 해당하는 선택지가 없습니다.` }); return; }
    questions.push({ content: row['문제'].toString().trim(), choices });
  });

  return { questions, errors };
};

export default function QuestionBanksPage() {
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 생성/수정 폼
  const [showCreate, setShowCreate] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBankSummary | null>(null);
  const [bankForm, setBankForm] = useState({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  // 아코디언 펼침 + 상세 캐시
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, QuestionBankDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // 삭제
  const [deleteTarget, setDeleteTarget] = useState<QuestionBankSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 엑셀 업로드
  const [showImportId, setShowImportId] = useState<string | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [excelRows, setExcelRows] = useState<BankQuestionInput[]>([]);
  const [excelErrors, setExcelErrors] = useState<{ row: number; reason: string }[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 문제 삭제
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [deletingQuestionBankId, setDeletingQuestionBankId] = useState<string | null>(null);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);

  // 문제 편집
  interface EditingQuestion {
    bankId: string;
    questionId: string;
    content: string;
    choices: Array<{ id: string; content: string; isCorrect: boolean; order: number }>;
  }
  const [editingQuestion, setEditingQuestion] = useState<EditingQuestion | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  const openEditQuestion = (bankId: string, q: QuestionBankDetail['questions'][number]) => {
    setEditingQuestion({
      bankId,
      questionId: q.id,
      content: q.content,
      choices: q.choices.map((c) => ({ id: c.id, content: c.content, isCorrect: c.isCorrect, order: c.order })),
    });
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion) return;
    setIsSavingQuestion(true);
    try {
      await questionBanksApi.updateQuestion(editingQuestion.bankId, editingQuestion.questionId, {
        content: editingQuestion.content,
        choices: editingQuestion.choices.map((c) => ({ content: c.content, isCorrect: c.isCorrect, order: c.order })),
      });
      showSuccess('문제가 수정되었습니다.');
      await refreshDetail(editingQuestion.bankId);
      setEditingQuestion(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '문제 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingQuestion(false);
    }
  };

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
    setLoadingDetailId(bankId);
    try {
      const detail = await questionBanksApi.getById(bankId);
      setDetailMap((prev) => ({ ...prev, [bankId]: detail }));
    } catch {
      setError('문제은행 상세를 불러오는 데 실패했습니다.');
    } finally {
      setLoadingDetailId(null);
    }
  };

  const refreshDetail = async (bankId: string) => {
    try {
      const detail = await questionBanksApi.getById(bankId);
      setDetailMap((prev) => ({ ...prev, [bankId]: detail }));
    } catch { /* ignore */ }
  };

  useEffect(() => { loadBanks(); }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // ── 아코디언 토글 ────────────────────────────────────────────
  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!detailMap[id]) await loadDetail(id);
  };

  // ── 저장 (생성/수정) ─────────────────────────────────────────
  const handleSave = async () => {
    if (!bankForm.name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      if (editingBank) {
        await questionBanksApi.update(editingBank.id, bankForm.name, bankForm.description || undefined);
        showSuccess('수정되었습니다.');
      } else {
        await questionBanksApi.create(bankForm.name, bankForm.description || undefined);
        showSuccess('문제은행이 생성되었습니다.');
      }
      setShowCreate(false);
      setEditingBank(null);
      setBankForm({ name: '', description: '' });
      await loadBanks();
      if (editingBank && detailMap[editingBank.id]) await refreshDetail(editingBank.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (bank: QuestionBankSummary) => {
    setEditingBank(bank);
    setBankForm({ name: bank.name, description: bank.description ?? '' });
    setShowCreate(true);
    setExpandedId(null);
  };

  // ── 삭제 ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await questionBanksApi.delete(deleteTarget.id);
      if (expandedId === deleteTarget.id) setExpandedId(null);
      setDeleteTarget(null);
      await loadBanks();
      showSuccess('삭제되었습니다.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── 엑셀 파싱 ────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelRows([]); setExcelErrors([]); setImportResult(null);
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

  const handleBulkImport = async (bankId: string) => {
    if (excelRows.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const result = await questionBanksApi.bulkImport(bankId, excelRows, replaceMode);
      setImportResult(result);
      setExcelRows([]);
      if (fileRef.current) fileRef.current.value = '';
      await loadBanks();
      await refreshDetail(bankId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '등록 중 오류가 발생했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  // ── 문제 삭제 ────────────────────────────────────────────────
  const handleDeleteQuestion = async () => {
    if (!deletingQuestionBankId || !deleteQuestionId) return;
    setIsDeletingQuestion(true);
    try {
      await questionBanksApi.deleteQuestion(deletingQuestionBankId, deleteQuestionId);
      setDeleteQuestionId(null);
      setDeletingQuestionBankId(null);
      await loadBanks();
      await refreshDetail(deletingQuestionBankId);
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
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">문제은행</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            시험에 사용할 문제 풀을 관리하세요
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingBank(null);
            setBankForm({ name: '', description: '' });
            setShowCreate((v) => !v);
          }}
        >
          {showCreate && !editingBank ? '취소' : '+ 신규'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-md border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2.5 text-xs font-medium text-[var(--success-text)]">
          {successMsg}
        </div>
      )}

      {/* 생성/수정 폼 */}
      {showCreate && (
        <div className="mb-5 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
            {editingBank ? '문제은행 수정' : '새 문제은행 생성'}
          </h2>
          <div className="flex flex-col gap-3">
            <Input
              label="이름"
              value={bankForm.name}
              onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
              placeholder="예: 소버린AI 과정 문제풀"
              autoFocus
            />
            <Input
              label="설명 (선택)"
              value={bankForm.description}
              onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })}
              placeholder="간단한 설명"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setEditingBank(null); }}>취소</Button>
              <Button size="sm" isLoading={isSaving} onClick={handleSave}>
                {editingBank ? '수정' : '생성'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 문제은행 목록 */}
      {banks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">생성된 문제은행이 없습니다</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">문제은행을 먼저 생성하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {banks.map((bank) => {
            const isExpanded = expandedId === bank.id;
            const detail = detailMap[bank.id];
            const isLoadingDetail = loadingDetailId === bank.id;
            const isShowingImport = showImportId === bank.id;

            return (
              <div key={bank.id} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--border-hover)]">
                {/* 헤더 행 */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <button
                    onClick={() => toggleExpand(bank.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-raised)] text-[#5e6ad2]">
                      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="2" width="5" height="5" rx="1" />
                        <rect x="9" y="2" width="5" height="5" rx="1" />
                        <rect x="2" y="9" width="5" height="5" rx="1" />
                        <rect x="9" y="9" width="5" height="5" rx="1" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">{bank.name}</p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span>문제 {bank._count.questions}개</span>
                        <span>·</span>
                        <span>시험 {bank._count.exams}개</span>
                        {bank.description && <span className="truncate max-w-[200px]">· {bank.description}</span>}
                      </div>
                    </div>
                    <svg
                      className={`ml-auto h-3.5 w-3.5 shrink-0 text-[var(--text-faint)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* 액션 버튼 */}
                  <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(bank)}>수정</Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteTarget(bank)}>삭제</Button>
                  </div>
                </div>

                {/* 펼침: 문제 목록 + 엑셀 업로드 */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-inset)]">
                    {isLoadingDetail ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
                      </div>
                    ) : !detail ? null : (
                      <div className="px-5 py-4">
                        {/* 엑셀 업로드 토글 버튼 */}
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                            문제 목록 ({detail.questions.length}개)
                          </p>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setShowImportId(isShowingImport ? null : bank.id);
                              setExcelRows([]); setExcelErrors([]); setImportResult(null);
                              if (fileRef.current) fileRef.current.value = '';
                            }}
                          >
                            {isShowingImport ? '닫기' : '📥 엑셀 일괄 등록'}
                          </Button>
                        </div>

                        {/* 엑셀 등록 패널 */}
                        {isShowingImport && (
                          <div className="mb-4 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-sm font-semibold text-[var(--text-primary)]">엑셀 일괄 등록</h3>
                                <p className="mt-0.5 text-xs text-[var(--text-muted)]">첫 번째 시트 기준으로 파싱합니다.</p>
                              </div>
                              <Button variant="secondary" size="sm" onClick={handleDownloadQuestionSample}>
                                📋 샘플 다운로드
                              </Button>
                            </div>

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
                                    <td className="pt-1.5 pr-3">보기1</td><td className="pt-1.5 pr-3">보기2</td>
                                    <td className="pt-1.5 pr-3">보기3</td><td className="pt-1.5 pr-3">보기4</td>
                                    <td className="pt-1.5 pr-3">-</td>
                                    <td className="pt-1.5 pr-3 text-[#5e6ad2] font-medium">2</td>
                                  </tr>
                                  <tr className="text-[var(--text-muted)]">
                                    <td className="pt-1.5 pr-3 whitespace-nowrap">복수 정답 문제</td>
                                    <td className="pt-1.5 pr-3">보기1</td><td className="pt-1.5 pr-3">보기2</td>
                                    <td className="pt-1.5 pr-3">보기3</td><td className="pt-1.5 pr-3">-</td>
                                    <td className="pt-1.5 pr-3">-</td>
                                    <td className="pt-1.5 pr-3 text-[#5e6ad2] font-medium">1,3</td>
                                  </tr>
                                </tbody>
                              </table>
                              <p className="mt-2 text-[var(--text-faint)]">• 선택지3~5는 비워도 됩니다. 정답은 선택지 번호(1~5), 복수 정답은 콤마로 구분.</p>
                            </div>

                            <div className="mb-3 flex items-center gap-3">
                              <input
                                ref={fileRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="block text-xs text-[var(--text-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[#5e6ad2] file:px-3 file:py-1.5 file:text-white file:text-xs file:cursor-pointer hover:file:bg-[#6b78e5]"
                              />
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input type="checkbox" checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)} className="accent-[#5e6ad2]" />
                                <span className="text-xs text-[var(--text-secondary)]">기존 문제 전체 교체</span>
                              </label>
                            </div>

                            {excelErrors.length > 0 && (
                              <div className="mb-3 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs">
                                <p className="font-medium text-[var(--danger-text)] mb-1">{excelErrors.length}개 행에서 오류 발견</p>
                                {excelErrors.slice(0, 5).map((e, i) => (
                                  <p key={i} className="text-[var(--danger-text)]">• {e.row > 0 ? `${e.row}행:` : ''} {e.reason}</p>
                                ))}
                                {excelErrors.length > 5 && <p className="text-[var(--danger-text)]">...외 {excelErrors.length - 5}개</p>}
                              </div>
                            )}

                            {importResult && (
                              <div className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-xs">
                                <p className="font-medium text-[var(--success-text)]">
                                  {importResult.success}문제 등록 완료
                                  {importResult.failed.length > 0 && ` / ${importResult.failed.length}문제 실패`}
                                </p>
                              </div>
                            )}

                            {excelRows.length > 0 && (
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-[var(--text-secondary)]">
                                  {excelRows.length}문제 파싱 완료
                                  {replaceMode && <span className="ml-1.5 text-[var(--warning-text)]">(기존 문제 전체 교체됨)</span>}
                                </p>
                                <Button size="sm" isLoading={isImporting} onClick={() => handleBulkImport(bank.id)}>
                                  {excelRows.length}문제 등록
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 문제 목록 */}
                        {detail.questions.length === 0 ? (
                          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-10 text-center">
                            <p className="text-sm text-[var(--text-muted)]">등록된 문제가 없습니다</p>
                            <p className="mt-1 text-xs text-[var(--text-faint)]">엑셀 일괄 등록으로 문제를 추가하세요</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {detail.questions.map((q, idx) => (
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
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      onClick={() => openEditQuestion(bank.id, q)}
                                      className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-raised)] hover:text-[#5e6ad2] transition-colors"
                                      title="문제 편집"
                                    >
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M11 2l3 3-8 8H3v-3L11 2z" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => { setDeleteQuestionId(q.id); setDeletingQuestionBankId(bank.id); }}
                                      className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] transition-colors"
                                      title="문제 삭제"
                                    >
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M3 4h10M6 4V2h4v2M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" strokeLinecap="round" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 삭제 확인 모달 - 문제은행 */}
      <Modal
        isOpen={!!deleteTarget}
        title="문제은행을 삭제하시겠습니까?"
        message={`"${deleteTarget?.name}" 및 포함된 모든 문제가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDelete}
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
        onCancel={() => { setDeleteQuestionId(null); setDeletingQuestionBankId(null); }}
        isLoading={isDeletingQuestion}
      />

      {/* ── 문제 편집 모달 ── */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingQuestion(null)} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <p className="font-semibold text-[var(--text-primary)]">문제 편집</p>
              <button onClick={() => setEditingQuestion(null)} className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-raised)]">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* 문제 내용 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">문제 내용</label>
                <textarea
                  value={editingQuestion.content}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, content: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#5e6ad2] focus:outline-none resize-none"
                />
              </div>

              {/* 선택지 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[var(--text-secondary)]">선택지 (정답 체크)</label>
                {editingQuestion.choices.map((choice, i) => (
                  <div key={choice.id} className="flex items-center gap-2">
                    <span className="shrink-0 w-5 text-center text-xs font-mono text-[var(--text-faint)]">{choice.order}.</span>
                    <input
                      type="text"
                      value={choice.content}
                      onChange={(e) => {
                        const next = [...editingQuestion.choices];
                        next[i] = { ...next[i], content: e.target.value };
                        setEditingQuestion({ ...editingQuestion, choices: next });
                      }}
                      className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:border-[#5e6ad2] focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const next = [...editingQuestion.choices];
                        next[i] = { ...next[i], isCorrect: !next[i].isCorrect };
                        setEditingQuestion({ ...editingQuestion, choices: next });
                      }}
                      className={`shrink-0 flex h-6 w-6 items-center justify-center rounded border text-xs transition-colors ${
                        choice.isCorrect
                          ? 'border-[#5e6ad2] bg-[#5e6ad2] text-white'
                          : 'border-[var(--border)] text-[var(--text-faint)] hover:border-[#5e6ad2]'
                      }`}
                      title="정답 토글"
                    >
                      ✓
                    </button>
                  </div>
                ))}
                {editingQuestion.choices.some((c) => c.isCorrect) || (
                  <p className="text-xs text-[var(--danger-text)]">정답을 1개 이상 선택하세요.</p>
                )}
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setEditingQuestion(null)}>취소</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveQuestion}
                disabled={isSavingQuestion || !editingQuestion.content.trim() || !editingQuestion.choices.some((c) => c.isCorrect)}
              >
                {isSavingQuestion ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
