// app/admin/exams/[id]/questions/page.tsx
// 역할: 관리자 문제 관리 페이지
// 변경 이력:
//   - 문제 추가: 한 번에 여러 문제를 작성 후 일괄 등록 (bulkCreate 활용)
//   - 정답 선택: 라디오 → 체크박스로 변경 (선다형 지원)
//   - 엑셀: 정답번호 컬럼이 "1" 또는 "1,3" 형식 모두 지원

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

// ─── 폼 타입 정의 ────────────────────────────────────────────

interface ChoiceForm {
  content: string;
  isCorrect: boolean;
  order: number;
}

interface QuestionForm {
  content: string;
  choices: ChoiceForm[];
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

// ─── 엑셀 행 타입 ────────────────────────────────────────────

interface ExcelRow {
  문제번호: number;
  문제내용: string;
  선택지1: string;
  선택지2: string;
  선택지3: string;
  선택지4: string;
  '정답번호(1~4)': string | number; // "1" 또는 "1,3" 형식 지원
}

// ─── 컴포넌트 ────────────────────────────────────────────────

export default function AdminQuestionsPage() {
  const { id: examId } = useParams<{ id: string }>();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 문제 일괄 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [questionForms, setQuestionForms] = useState<QuestionForm[]>([makeDefaultQuestion()]);
  const [isAdding, setIsAdding] = useState(false);

  // 삭제
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 엑셀 일괄 업로드
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [excelPreview, setExcelPreview] = useState<ExcelRow[]>([]);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  const loadExam = () => {
    examsApi
      .getById(examId)
      .then(setExam)
      .catch(() => setError('시험 정보를 불러오는 데 실패했습니다.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // ───── 문제 폼 조작 ─────────────────────────────────────────

  const addQuestionCard = () => {
    setQuestionForms((prev) => [...prev, makeDefaultQuestion()]);
  };

  const removeQuestionCard = (qIdx: number) => {
    setQuestionForms((prev) => prev.filter((_, i) => i !== qIdx));
  };

  const updateQuestionContent = (qIdx: number, value: string) => {
    setQuestionForms((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, content: value } : q)),
    );
  };

  const updateChoiceContent = (qIdx: number, cIdx: number, value: string) => {
    setQuestionForms((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              choices: q.choices.map((c, ci) => (ci === cIdx ? { ...c, content: value } : c)),
            }
          : q,
      ),
    );
  };

  // 정답 체크박스 토글 — 복수 정답 지원
  const toggleCorrect = (qIdx: number, cIdx: number) => {
    setQuestionForms((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              choices: q.choices.map((c, ci) =>
                ci === cIdx ? { ...c, isCorrect: !c.isCorrect } : c,
              ),
            }
          : q,
      ),
    );
  };

  // ───── 일괄 문제 등록 ────────────────────────────────────────

  const handleBulkAdd = async () => {
    setError(null);

    // 유효성 검사
    for (let i = 0; i < questionForms.length; i++) {
      const q = questionForms[i];
      if (!q.content.trim()) {
        setError(`Q${i + 1}: 문제 내용을 입력해주세요.`);
        return;
      }
      if (q.choices.some((c) => !c.content.trim())) {
        setError(`Q${i + 1}: 모든 선택지를 입력해주세요.`);
        return;
      }
      if (!q.choices.some((c) => c.isCorrect)) {
        setError(`Q${i + 1}: 정답을 최소 1개 이상 선택해주세요.`);
        return;
      }
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
      setShowAddForm(false);
      loadExam();
      // 결과 메시지는 페이지 상단에 잠깐 표시
      setUploadResult(`✅ ${result.count}개 문제가 등록되었습니다.`);
      setTimeout(() => setUploadResult(null), 4000);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('문제 등록 중 오류가 발생했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  // ───── 엑셀 파싱 ─────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelError(null);
    setExcelPreview([]);
    setUploadResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['문제목록'];
        if (!ws) {
          setExcelError("'문제목록' 시트를 찾을 수 없습니다. 샘플 형식을 확인해주세요.");
          return;
        }

        const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws);
        if (rows.length === 0) {
          setExcelError('데이터가 없습니다. 최소 1개 이상의 문제를 입력해주세요.');
          return;
        }

        // 유효성 검사
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r['문제내용']?.toString().trim()) {
            setExcelError(`${i + 2}행: 문제내용이 비어있습니다.`);
            return;
          }
          if (!r['선택지1'] || !r['선택지2'] || !r['선택지3'] || !r['선택지4']) {
            setExcelError(`${i + 2}행: 선택지1~4를 모두 입력해주세요.`);
            return;
          }
          // 정답번호: "1" 또는 "1,3" 형식
          const ansStr = r['정답번호(1~4)']?.toString().trim() ?? '';
          const ansNums = ansStr.split(',').map((s) => Number(s.trim()));
          if (ansNums.some((n) => isNaN(n) || n < 1 || n > 4)) {
            setExcelError(
              `${i + 2}행: 정답번호는 1~4 숫자를 쉼표로 구분해 입력하세요. (예: 2 또는 1,3)`,
            );
            return;
          }
        }

        setExcelPreview(rows);
      } catch {
        setExcelError('파일을 읽는 중 오류가 발생했습니다. 올바른 .xlsx 파일인지 확인해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExcelUpload = async () => {
    if (excelPreview.length === 0) return;
    setIsUploading(true);
    setError(null);
    setUploadResult(null);

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
      setUploadResult(`✅ ${result.count}개 문제가 성공적으로 등록되었습니다.`);
      setExcelPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadExam();
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
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* 브레드크럼 */}
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/exams" className="hover:underline">시험 관리</Link>
        <span>›</span>
        <span>{exam?.title}</span>
      </div>

      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">문제 관리</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowExcelUpload((v) => !v);
              setShowAddForm(false);
              setUploadResult(null);
              setExcelPreview([]);
              setExcelError(null);
            }}
          >
            {showExcelUpload ? '취소' : '📥 엑셀 일괄 업로드'}
          </Button>
          <Button
            onClick={() => {
              setShowAddForm((v) => !v);
              setShowExcelUpload(false);
              setQuestionForms([makeDefaultQuestion()]);
            }}
          >
            {showAddForm ? '취소' : '+ 문제 추가'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {uploadResult && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 font-medium">
          {uploadResult}
        </div>
      )}

      {/* ── 엑셀 일괄 업로드 섹션 ── */}
      {showExcelUpload && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="mb-1 font-semibold text-green-800">엑셀 일괄 업로드</h2>
          <p className="mb-3 text-sm text-green-700">
            아래 컬럼 형식에 맞춰 작성한 .xlsx 파일을 업로드하면 문제가 자동 등록됩니다.
          </p>

          {/* 컬럼 형식 안내 */}
          <div className="mb-4 rounded-lg border border-green-300 bg-white px-4 py-3 text-sm">
            <p className="font-medium text-gray-700 mb-2">
              엑셀 컬럼 형식
              <span className="ml-2 text-xs font-normal text-blue-600">
                ※ 복수 정답은 쉼표로 구분 (예: 1,3)
              </span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-gray-600">
                <thead>
                  <tr className="bg-gray-100">
                    {['문제번호', '문제내용', '선택지1', '선택지2', '선택지3', '선택지4', '정답번호(1~4)'].map((h) => (
                      <th key={h} className="border border-gray-200 px-2 py-1 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-2 py-1 text-center">1</td>
                    <td className="border border-gray-200 px-2 py-1">파이썬 리스트 정의 방법은?</td>
                    <td className="border border-gray-200 px-2 py-1">a = (1,2)</td>
                    <td className="border border-gray-200 px-2 py-1">a = [1,2]</td>
                    <td className="border border-gray-200 px-2 py-1">a = {'{1,2}'}</td>
                    <td className="border border-gray-200 px-2 py-1">a = &lt;1,2&gt;</td>
                    <td className="border border-gray-200 px-2 py-1 text-center font-bold text-blue-600">2</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-2 py-1 text-center">2</td>
                    <td className="border border-gray-200 px-2 py-1">다음 중 정렬 알고리즘을 모두 고르시오</td>
                    <td className="border border-gray-200 px-2 py-1">버블 정렬</td>
                    <td className="border border-gray-200 px-2 py-1">DFS</td>
                    <td className="border border-gray-200 px-2 py-1">퀵 정렬</td>
                    <td className="border border-gray-200 px-2 py-1">BFS</td>
                    <td className="border border-gray-200 px-2 py-1 text-center font-bold text-blue-600">1,3</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-green-600 file:px-3 file:py-2 file:text-white file:text-sm file:cursor-pointer hover:file:bg-green-700"
            />
          </div>

          {excelError && (
            <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{excelError}</div>
          )}
          {uploadResult && showExcelUpload && (
            <div className="mb-3 rounded-lg bg-green-100 p-3 text-sm text-green-800 font-medium">
              {uploadResult}
            </div>
          )}

          {/* 미리보기 */}
          {excelPreview.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-gray-700">
                미리보기 ({excelPreview.length}개 문제)
              </p>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {excelPreview.map((row, idx) => {
                  const ansStr = row['정답번호(1~4)']?.toString() ?? '';
                  return (
                    <div key={idx} className="border-b border-gray-100 px-4 py-2 text-sm last:border-0">
                      <p className="font-medium text-gray-800">
                        <span className="mr-2 text-blue-600">Q{idx + 1}.</span>
                        {row['문제내용']}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        ① {row['선택지1']} ② {row['선택지2']} ③ {row['선택지3']} ④ {row['선택지4']}
                        <span className="ml-2 font-semibold text-green-700">
                          정답: {ansStr}번
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
              <Button className="mt-3" isLoading={isUploading} onClick={handleExcelUpload}>
                {excelPreview.length}개 문제 등록
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── 문제 일괄 추가 폼 ── */}
      {showAddForm && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-blue-900">
              문제 일괄 추가
              <span className="ml-2 text-sm font-normal text-blue-600">
                ({questionForms.length}개 작성 중)
              </span>
            </h2>
          </div>

          <div className="flex flex-col gap-6">
            {questionForms.map((qForm, qIdx) => (
              <div
                key={qIdx}
                className="rounded-xl border border-blue-300 bg-white p-4 shadow-sm"
              >
                {/* 문제 헤더 */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-700">Q{qIdx + 1}</span>
                  {questionForms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestionCard(qIdx)}
                      className="text-xs text-red-500 hover:text-red-700"
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
                    onChange={(e) => updateQuestionContent(qIdx, e.target.value)}
                    placeholder="문제를 입력하세요"
                  />
                </div>

                {/* 선택지 */}
                <p className="mb-2 text-xs font-medium text-gray-600">
                  선택지 및 정답 선택
                  <span className="ml-1 text-blue-500">(복수 정답 허용 — 체크박스로 선택)</span>
                </p>
                <div className="flex flex-col gap-2">
                  {qForm.choices.map((choice, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={choice.isCorrect}
                        onChange={() => toggleCorrect(qIdx, cIdx)}
                        className="h-4 w-4 rounded text-blue-600"
                        title="정답으로 선택"
                      />
                      <input
                        type="text"
                        value={choice.content}
                        onChange={(e) => updateChoiceContent(qIdx, cIdx, e.target.value)}
                        placeholder={`선택지 ${cIdx + 1}`}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {choice.isCorrect && (
                        <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                          ✓ 정답
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  체크박스에 체크된 선택지가 정답으로 설정됩니다.
                </p>
              </div>
            ))}
          </div>

          {/* 문제 추가 / 등록 버튼 */}
          <div className="mt-4 flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={addQuestionCard}
            >
              + 문제 더 추가
            </Button>
            <Button
              type="button"
              isLoading={isAdding}
              onClick={handleBulkAdd}
            >
              {questionForms.length}개 문제 등록
            </Button>
          </div>
        </div>
      )}

      {/* ── 문제 목록 ── */}
      {!exam?.questions?.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
          등록된 문제가 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exam.questions.map((q: Question, idx) => (
            <div
              key={q.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-900">
                      <span className="mr-2 text-blue-600">Q{idx + 1}.</span>
                      {q.content}
                    </p>
                    {q.answerCount > 1 && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        복수 정답 {q.answerCount}개
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-1 pl-6">
                    {q.choices.map((c) => (
                      <p key={c.id} className="text-sm text-gray-600">
                        {c.order}. {c.content}
                      </p>
                    ))}
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTargetId(q.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
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
