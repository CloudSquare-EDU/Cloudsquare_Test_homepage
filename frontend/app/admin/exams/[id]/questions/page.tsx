// app/admin/exams/[id]/questions/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
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

interface QuestionForm {
  content: string;
  choices: ChoiceForm[];
}

interface ExcelRow {
  문제번호: number;
  문제내용: string;
  선택지1: string;
  선택지2: string;
  선택지3: string;
  선택지4: string;
  '정답번호(1~4)': string | number;
}

const makeDefaultQuestion = (): QuestionForm => ({
  content: '',
  choices: [
    { content: '', isCorrect: false, order: 1 },
    { content: '', isCorrect: false, order: 2 },
    { content: '', isCorrect: false, order: 3 },
    { content: '', isCorrect: false, order: 4 },
  ],
});

type PanelMode = 'none' | 'add' | 'excel';

export default function AdminQuestionsPage() {
  const { id: examId } = useParams<{ id: string }>();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  const [questionForms, setQuestionForms] = useState<QuestionForm[]>([makeDefaultQuestion()]);
  const [isAdding, setIsAdding] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [excelPreview, setExcelPreview] = useState<ExcelRow[]>([]);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadExam = () => {
    examsApi
      .getById(examId)
      .then(setExam)
      .catch(() => setError('시험 정보를 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadExam(); }, [examId]);

  const openPanel = (mode: PanelMode) => {
    setPanelMode((prev) => prev === mode ? 'none' : mode);
    setQuestionForms([makeDefaultQuestion()]);
    setExcelPreview([]);
    setExcelError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ── 문제 폼 조작 ──────────────────────────────────────────

  const addQuestionCard = () => setQuestionForms((p) => [...p, makeDefaultQuestion()]);
  const removeQuestionCard = (qi: number) => setQuestionForms((p) => p.filter((_, i) => i !== qi));
  const updateContent = (qi: number, v: string) =>
    setQuestionForms((p) => p.map((q, i) => i === qi ? { ...q, content: v } : q));
  const updateChoice = (qi: number, ci: number, v: string) =>
    setQuestionForms((p) =>
      p.map((q, i) =>
        i === qi ? { ...q, choices: q.choices.map((c, j) => j === ci ? { ...c, content: v } : c) } : q
      )
    );
  const toggleCorrect = (qi: number, ci: number) =>
    setQuestionForms((p) =>
      p.map((q, i) =>
        i === qi ? { ...q, choices: q.choices.map((c, j) => j === ci ? { ...c, isCorrect: !c.isCorrect } : c) } : q
      )
    );

  // ── 일괄 등록 ────────────────────────────────────────────

  const handleBulkAdd = async () => {
    setError(null);
    for (let i = 0; i < questionForms.length; i++) {
      const q = questionForms[i];
      if (!q.content.trim()) { setError(`Q${i + 1}: 문제 내용을 입력해주세요.`); return; }
      if (q.choices.some((c) => !c.content.trim())) { setError(`Q${i + 1}: 모든 선택지를 입력해주세요.`); return; }
      if (!q.choices.some((c) => c.isCorrect)) { setError(`Q${i + 1}: 정답을 최소 1개 이상 선택해주세요.`); return; }
    }

    setIsAdding(true);
    try {
      const currentCount = exam?.questions?.length ?? 0;
      const questions = questionForms.map((q, idx) => ({
        content: q.content.trim(),
        order: currentCount + idx + 1,
        choices: q.choices,
      }));
      const result = await questionsApi.bulkCreate(examId, questions);
      setQuestionForms([makeDefaultQuestion()]);
      setPanelMode('none');
      loadExam();
      showSuccess(`${result.count}개 문제가 등록되었습니다.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '문제 등록 중 오류가 발생했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  // ── 엑셀 파싱 ────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelError(null);
    setExcelPreview([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['문제목록'];
        if (!ws) { setExcelError("'문제목록' 시트를 찾을 수 없습니다."); return; }
        const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws);
        if (rows.length === 0) { setExcelError('데이터가 없습니다.'); return; }
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r['문제내용']?.toString().trim()) { setExcelError(`${i + 2}행: 문제내용이 비어있습니다.`); return; }
          if (!r['선택지1'] || !r['선택지2'] || !r['선택지3'] || !r['선택지4']) {
            setExcelError(`${i + 2}행: 선택지1~4를 모두 입력해주세요.`); return;
          }
          const ansStr = r['정답번호(1~4)']?.toString().trim() ?? '';
          const ansNums = ansStr.split(',').map((s) => Number(s.trim()));
          if (ansNums.some((n) => isNaN(n) || n < 1 || n > 4)) {
            setExcelError(`${i + 2}행: 정답번호는 1~4 숫자를 쉼표로 구분하세요. (예: 2 또는 1,3)`); return;
          }
        }
        setExcelPreview(rows);
      } catch {
        setExcelError('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExcelUpload = async () => {
    if (excelPreview.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      const currentCount = exam?.questions?.length ?? 0;
      const questions = excelPreview.map((r, idx) => {
        const ansStr = r['정답번호(1~4)']?.toString().trim() ?? '';
        const ansNums = new Set(ansStr.split(',').map((s) => Number(s.trim())));
        return {
          content: r['문제내용'].toString().trim(),
          order: currentCount + idx + 1,
          choices: [
            { content: r['선택지1'].toString(), isCorrect: ansNums.has(1), order: 1 },
            { content: r['선택지2'].toString(), isCorrect: ansNums.has(2), order: 2 },
            { content: r['선택지3'].toString(), isCorrect: ansNums.has(3), order: 3 },
            { content: r['선택지4'].toString(), isCorrect: ansNums.has(4), order: 4 },
          ],
        };
      });
      const result = await questionsApi.bulkCreate(examId, questions);
      setExcelPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPanelMode('none');
      loadExam();
      showSuccess(`${result.count}개 문제가 등록되었습니다.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* 브레드크럼 */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
        <Link href="/admin/exams" className="hover:text-[var(--text-secondary)] transition-colors">시험 관리</Link>
        <span>›</span>
        <span className="text-[var(--text-secondary)]">{exam?.title}</span>
      </div>

      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">문제 관리</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">총 {exam?.questions?.length ?? 0}개 문제</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openPanel('excel')}
          >
            {panelMode === 'excel' ? '취소' : '엑셀 업로드'}
          </Button>
          <Button
            size="sm"
            onClick={() => openPanel('add')}
          >
            {panelMode === 'add' ? '취소' : '+ 문제 추가'}
          </Button>
        </div>
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

      {/* ── 엑셀 업로드 패널 ── */}
      {panelMode === 'excel' && (
        <div className="mb-5 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">엑셀 일괄 업로드</h2>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            아래 컬럼 형식의 .xlsx 파일을 업로드하면 문제가 자동 등록됩니다.
            <span className="ml-2 text-[#5e6ad2]">복수 정답은 쉼표로 구분 (예: 1,3)</span>
          </p>

          {/* 컬럼 형식 안내 */}
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">엑셀 컬럼 형식</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-[var(--text-muted)]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    {['문제번호', '문제내용', '선택지1', '선택지2', '선택지3', '선택지4', '정답번호(1~4)'].map((h) => (
                      <th key={h} className="pb-1.5 pr-3 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[var(--text-faint)]">
                  <tr>
                    <td className="pt-1.5 pr-3">1</td>
                    <td className="pt-1.5 pr-3">파이썬 리스트 정의 방법은?</td>
                    <td className="pt-1.5 pr-3">a = (1,2)</td>
                    <td className="pt-1.5 pr-3">a = [1,2]</td>
                    <td className="pt-1.5 pr-3">{'a = {1,2}'}</td>
                    <td className="pt-1.5 pr-3">a = &lt;1,2&gt;</td>
                    <td className="pt-1.5 pr-3 font-bold text-[#5e6ad2]">2</td>
                  </tr>
                  <tr>
                    <td className="pt-1 pr-3">2</td>
                    <td className="pt-1 pr-3">정렬 알고리즘을 모두 고르시오</td>
                    <td className="pt-1 pr-3">버블 정렬</td>
                    <td className="pt-1 pr-3">DFS</td>
                    <td className="pt-1 pr-3">퀵 정렬</td>
                    <td className="pt-1 pr-3">BFS</td>
                    <td className="pt-1 pr-3 font-bold text-[#5e6ad2]">1,3</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block text-xs text-[var(--text-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[#5e6ad2] file:px-3 file:py-1.5 file:text-white file:text-xs file:cursor-pointer hover:file:bg-[#6b78e5]"
            />
          </div>

          {excelError && (
            <div className="mb-3 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
              {excelError}
            </div>
          )}

          {excelPreview.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">미리보기 ({excelPreview.length}개 문제)</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-inset)]">
                {excelPreview.map((row, idx) => {
                  const ansStr = row['정답번호(1~4)']?.toString() ?? '';
                  return (
                    <div key={idx} className="border-b border-[var(--border-subtle)] px-4 py-2.5 last:border-0">
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        <span className="mr-2 text-[#5e6ad2]">Q{idx + 1}.</span>
                        {row['문제내용']}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                        ① {row['선택지1']} &nbsp;② {row['선택지2']} &nbsp;③ {row['선택지3']} &nbsp;④ {row['선택지4']}
                        <span className="ml-2 text-green-500 font-medium">정답: {ansStr}번</span>
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" isLoading={isUploading} onClick={handleExcelUpload}>
                  {excelPreview.length}개 문제 등록
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 문제 일괄 추가 패널 ── */}
      {panelMode === 'add' && (
        <div className="mb-5 rounded-xl border border-[rgba(94,106,210,0.3)] bg-[var(--bg-surface)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              문제 추가
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{questionForms.length}개 작성 중</span>
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {questionForms.map((qForm, qi) => (
              <div key={qi} className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-4">
                {/* 문제 헤더 */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#5e6ad2]">Q{qi + 1}</span>
                  {questionForms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestionCard(qi)}
                      className="text-xs text-[var(--text-faint)] hover:text-[var(--danger-text)] transition-colors"
                    >
                      ✕ 삭제
                    </button>
                  )}
                </div>

                {/* 문제 내용 */}
                <div className="mb-3">
                  <Input
                    label="문제 내용"
                    value={qForm.content}
                    onChange={(e) => updateContent(qi, e.target.value)}
                    placeholder="문제를 입력하세요"
                  />
                </div>

                {/* 선택지 */}
                <p className="mb-2 text-xs text-[var(--text-muted)]">
                  선택지 및 정답
                  <span className="ml-1 text-[#5e6ad2]">(체크박스로 복수 정답 선택 가능)</span>
                </p>
                <div className="flex flex-col gap-2">
                  {qForm.choices.map((choice, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCorrect(qi, ci)}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          choice.isCorrect
                            ? 'border-[#5e6ad2] bg-[#5e6ad2] text-white'
                            : 'border-[var(--border-hover)] bg-transparent'
                        }`}
                        title="정답으로 선택"
                      >
                        {choice.isCorrect && (
                          <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <input
                        type="text"
                        value={choice.content}
                        onChange={(e) => updateChoice(qi, ci, e.target.value)}
                        placeholder={`선택지 ${ci + 1}`}
                        className={`flex-1 rounded-md border bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none transition-colors ${
                          choice.isCorrect
                            ? 'border-[rgba(94,106,210,0.5)]'
                            : 'border-[var(--border)] focus:border-[#5e6ad2]'
                        }`}
                      />
                      {choice.isCorrect && (
                        <span className="shrink-0 text-[10px] font-medium text-[#5e6ad2]">정답</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={addQuestionCard}>
              + 문제 더 추가
            </Button>
            <Button type="button" size="sm" isLoading={isAdding} onClick={handleBulkAdd}>
              {questionForms.length}개 문제 등록
            </Button>
          </div>
        </div>
      )}

      {/* ── 문제 목록 ── */}
      {!exam?.questions?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">등록된 문제가 없습니다</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">위 버튼으로 문제를 추가하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exam.questions.map((q: Question, idx) => (
            <div
              key={q.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4 hover:border-[var(--border-hover)] transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* 문제 번호 배지 */}
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--bg-raised)] text-[10px] font-bold text-[#5e6ad2] mt-0.5">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{q.content}</p>
                    {q.answerCount > 1 && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--bg-raised)] text-[#5e6ad2]">
                        복수 {q.answerCount}개
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {q.choices.map((c) => (
                      <p key={c.id} className="text-xs text-[var(--text-faint)]">
                        {c.order}. {c.content}
                      </p>
                    ))}
                  </div>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTargetId(q.id)}
                  className="shrink-0"
                >
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
