// app/admin/exams/[id]/questions/page.tsx
// 역할: 관리자 문제 관리 페이지 — 특정 시험의 문제 목록 조회, 문제 추가(개별/엑셀 일괄), 삭제

'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
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

const DEFAULT_CHOICES: ChoiceForm[] = [
  { content: '', isCorrect: false, order: 1 },
  { content: '', isCorrect: false, order: 2 },
  { content: '', isCorrect: false, order: 3 },
  { content: '', isCorrect: false, order: 4 },
];

interface ExcelRow {
  문제번호: number;
  문제내용: string;
  선택지1: string;
  선택지2: string;
  선택지3: string;
  선택지4: string;
  '정답번호(1~4)': number;
}

export default function AdminQuestionsPage() {
  const { id: examId } = useParams<{ id: string }>();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 개별 문제 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [questionContent, setQuestionContent] = useState('');
  const [choices, setChoices] = useState<ChoiceForm[]>(DEFAULT_CHOICES);
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
  }, [examId]);

  // ───── 개별 문제 추가 ─────
  const handleChoiceChange = (index: number, value: string) => {
    setChoices((prev) => prev.map((c, i) => (i === index ? { ...c, content: value } : c)));
  };

  const handleCorrectSelect = (index: number) => {
    setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === index })));
  };

  const handleAddQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!exam) return;

    const correctSelected = choices.some((c) => c.isCorrect);
    if (!correctSelected) { setError('정답을 선택해주세요.'); return; }
    if (choices.some((c) => !c.content.trim())) { setError('모든 선택지를 입력해주세요.'); return; }

    setIsAdding(true);
    setError(null);
    try {
      await questionsApi.create({
        examId,
        content: questionContent,
        order: (exam.questions?.length ?? 0) + 1,
        choices,
      });
      setQuestionContent('');
      setChoices(DEFAULT_CHOICES);
      setShowAddForm(false);
      loadExam();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  // ───── 엑셀 파싱 ─────
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
        if (!ws) { setExcelError("'문제목록' 시트를 찾을 수 없습니다. 샘플 파일 형식을 확인해주세요."); return; }

        const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws);
        if (rows.length === 0) { setExcelError('데이터가 없습니다. 최소 1개 이상의 문제를 입력해주세요.'); return; }

        // 유효성 검사
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r['문제내용']?.toString().trim()) { setExcelError(`${i + 2}행: 문제내용이 비어있습니다.`); return; }
          if (!r['선택지1'] || !r['선택지2'] || !r['선택지3'] || !r['선택지4']) {
            setExcelError(`${i + 2}행: 선택지1~4를 모두 입력해주세요.`); return;
          }
          const ans = Number(r['정답번호(1~4)']);
          if (![1, 2, 3, 4].includes(ans)) { setExcelError(`${i + 2}행: 정답번호는 1~4 사이 숫자여야 합니다.`); return; }
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
      const questions = excelPreview.map((r, idx) => {
        const ans = Number(r['정답번호(1~4)']);
        return {
          content: r['문제내용'].toString().trim(),
          order: idx + 1,
          choices: [
            { content: r['선택지1'].toString(), isCorrect: ans === 1, order: 1 },
            { content: r['선택지2'].toString(), isCorrect: ans === 2, order: 2 },
            { content: r['선택지3'].toString(), isCorrect: ans === 3, order: 3 },
            { content: r['선택지4'].toString(), isCorrect: ans === 4, order: 4 },
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
            onClick={() => { setShowExcelUpload((v) => !v); setShowAddForm(false); setUploadResult(null); setExcelPreview([]); setExcelError(null); }}
          >
            {showExcelUpload ? '취소' : '📥 엑셀 일괄 업로드'}
          </Button>
          <Button onClick={() => { setShowAddForm((v) => !v); setShowExcelUpload(false); }}>
            {showAddForm ? '취소' : '+ 문제 추가'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── 엑셀 일괄 업로드 섹션 ── */}
      {showExcelUpload && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="mb-1 font-semibold text-green-800">엑셀 일괄 업로드</h2>
          <p className="mb-3 text-sm text-green-700">
            샘플 파일 형식에 맞춰 작성한 .xlsx 파일을 업로드하면 문제가 자동으로 등록됩니다.
          </p>

          {/* 샘플 다운로드 안내 */}
          <div className="mb-4 rounded-lg border border-green-300 bg-white px-4 py-3 text-sm">
            <p className="font-medium text-gray-700 mb-1">엑셀 컬럼 형식</p>
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
                    <td className="border border-gray-200 px-2 py-1">파이썬에서 리스트 정의 방법은?</td>
                    <td className="border border-gray-200 px-2 py-1">a = (1,2,3)</td>
                    <td className="border border-gray-200 px-2 py-1">a = [1,2,3]</td>
                    <td className="border border-gray-200 px-2 py-1">a = {'{1,2,3}'}</td>
                    <td className="border border-gray-200 px-2 py-1">a = &lt;1,2,3&gt;</td>
                    <td className="border border-gray-200 px-2 py-1 text-center font-bold text-blue-600">2</td>
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

          {uploadResult && (
            <div className="mb-3 rounded-lg bg-green-100 p-3 text-sm text-green-800 font-medium">{uploadResult}</div>
          )}

          {/* 미리보기 */}
          {excelPreview.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-gray-700">
                미리보기 ({excelPreview.length}개 문제)
              </p>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {excelPreview.map((row, idx) => (
                  <div key={idx} className="border-b border-gray-100 px-4 py-2 text-sm last:border-0">
                    <p className="font-medium text-gray-800">
                      <span className="mr-2 text-blue-600">Q{idx + 1}.</span>
                      {row['문제내용']}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      ① {row['선택지1']} ② {row['선택지2']} ③ {row['선택지3']} ④ {row['선택지4']}
                      {' '}
                      <span className="ml-2 font-semibold text-green-700">
                        정답: {row['정답번호(1~4)']}번
                      </span>
                    </p>
                  </div>
                ))}
              </div>
              <Button
                className="mt-3"
                isLoading={isUploading}
                onClick={handleExcelUpload}
              >
                {excelPreview.length}개 문제 등록
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── 개별 문제 추가 폼 ── */}
      {showAddForm && (
        <form
          onSubmit={handleAddQuestion}
          className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5"
        >
          <h2 className="mb-4 font-semibold">새 문제 추가</h2>
          <div className="mb-4">
            <Input
              label="문제 내용"
              value={questionContent}
              onChange={(e) => setQuestionContent(e.target.value)}
              required
            />
          </div>
          <p className="mb-2 text-sm font-medium text-gray-700">선택지 (라디오 버튼으로 정답 선택)</p>
          <div className="flex flex-col gap-2 mb-4">
            {choices.map((choice, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={choice.isCorrect}
                  onChange={() => handleCorrectSelect(idx)}
                  className="h-4 w-4 text-blue-600"
                />
                <input
                  type="text"
                  value={choice.content}
                  onChange={(e) => handleChoiceChange(idx, e.target.value)}
                  placeholder={`선택지 ${idx + 1}`}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {choice.isCorrect && (
                  <span className="text-xs text-green-600 font-medium">정답</span>
                )}
              </div>
            ))}
          </div>
          <Button type="submit" isLoading={isAdding}>
            문제 추가
          </Button>
        </form>
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
                  <p className="font-medium text-gray-900">
                    <span className="mr-2 text-blue-600">Q{idx + 1}.</span>
                    {q.content}
                  </p>
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
