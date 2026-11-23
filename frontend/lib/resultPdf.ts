// lib/resultPdf.ts
// 역할: 응시 결과서 PDF 생성 (관리자) — 학생 1명 바로 다운로드 / 시험 전체를 학생별 파일로 묶은 ZIP 저장
// 설계 이유:
//   - pdfmake 로 텍스트 PDF를 만든다 → 인쇄 창 없이 바로 저장, 글자 선택 가능, 파일 크기 작음
//   - 한글은 public/fonts 의 나눔고딕(OFL 라이선스)을 사용 — 나눔고딕에 없는 기호(✓ ✗ ㈜ 등)는 쓰지 않는다
//   - pdfmake·jszip·글꼴은 버튼을 누를 때만 불러온다 (일반 화면 로딩에 영향 없음)

import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { submissionsApi } from './api/submissions';
import { SubmissionDetail } from './types';

type PdfMake = typeof import('pdfmake/build/pdfmake');

const COLOR = {
  text: '#1a1a2e',
  sub: '#4a4a60',
  faint: '#8a8a9a',
  line: '#d9dae3',
  label: '#f1f2f6',
  ok: '#15803d',
  okBg: '#f3faf5',
  okLine: '#b9e0c5',
  bad: '#b91c1c',
  badBg: '#fdf4f4',
  badLine: '#efc4c4',
  none: '#6b6b7b',
  noneBg: '#f6f6f8',
  accent: '#5e6ad2',
};

let pdfMakeLoader: Promise<PdfMake> | null = null;

const loadPdfMake = (): Promise<PdfMake> => {
  if (!pdfMakeLoader) {
    pdfMakeLoader = import('pdfmake/build/pdfmake')
      .then((mod) => {
        const pdfMake = ((mod as unknown as { default?: PdfMake }).default ?? mod) as PdfMake;
        const base = `${window.location.origin}/fonts`;
        pdfMake.addFonts({
          NanumGothic: {
            normal: `${base}/NanumGothic-Regular.ttf`,
            bold: `${base}/NanumGothic-Bold.ttf`,
            italics: `${base}/NanumGothic-Regular.ttf`,
            bolditalics: `${base}/NanumGothic-Bold.ttf`,
          },
        });
        return pdfMake;
      })
      .catch((err) => {
        pdfMakeLoader = null; // 실패 시 다음 클릭에서 다시 시도
        throw err;
      });
  }
  return pdfMakeLoader;
};

const sanitize = (name: string) => name.replace(/[\\/:*?"<>|\r\n]+/g, '_').replace(/\s+/g, ' ').trim();

// 파일명: 이름_학번(없으면 이메일 아이디)_시험명[_N회차].pdf
export const resultPdfFileName = (d: SubmissionDetail): string => {
  const who = d.user?.name ?? '응시자';
  const id = d.user?.studentNumber || d.user?.email.split('@')[0] || d.id;
  const nth = (d.attemptCount ?? 1) > 1 && d.attemptNo ? `_${d.attemptNo}회차` : '';
  return `${sanitize(`${who}_${id}_${d.exam.title}${nth}`)}.pdf`;
};

const buildDoc = (d: SubmissionDetail): TDocumentDefinitions => {
  const qs = d.questionResults;
  const correct = qs.filter((q) => q.isCorrect).length;
  const unanswered = qs.filter((q) => q.isAnswered === false).length;
  const wrong = d.totalQuestions - correct - unanswered;
  const score = d.score ?? Math.round((correct / Math.max(d.totalQuestions, 1)) * 100);
  const scoreColor = score >= 80 ? COLOR.ok : score >= 60 ? '#a16207' : COLOR.bad;
  const nth = (d.attemptCount ?? 1) > 1 && d.attemptNo ? ` · ${d.attemptNo}회차 (총 ${d.attemptCount}회 응시)` : '';
  const printedAt = new Date().toLocaleString('ko-KR');

  const label = (text: string): TableCell => ({ text, bold: true, color: COLOR.sub, fillColor: COLOR.label });
  const thinGrid = {
    hLineWidth: () => 0.6,
    vLineWidth: () => 0.6,
    hLineColor: () => COLOR.line,
    vLineColor: () => COLOR.line,
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 4,
    paddingBottom: () => 4,
  };

  const infoTable: Content = {
    table: {
      widths: [58, '*', 58, '*'],
      body: [
        [label('시험명'), { text: d.exam.title, bold: true, colSpan: 3 }, {}, {}],
        [label('응시자'), d.user?.name ?? '-', label('학번'), d.user?.studentNumber || '-'],
        [label('이메일'), d.user?.email ?? '-', label('과정'), d.user?.courseName || '-'],
        [
          label('응시일시'),
          new Date(d.submittedAt).toLocaleString('ko-KR'),
          label('시험 구분'),
          `${d.exam.examType === 'REAL_EXAM' ? '실제 시험' : '모의시험(자기주도학습)'}${nth}`,
        ],
        [
          label('점수'),
          { text: `${score}점`, bold: true, fontSize: 12, color: scoreColor },
          label('정오 현황'),
          `정답 ${correct} · 오답 ${wrong}${unanswered > 0 ? ` · 미응답 ${unanswered}` : ''} (총 ${d.totalQuestions}문제)`,
        ],
      ],
    },
    layout: thinGrid,
  };

  // 문제 1개 = 테두리 상자 1개. 상태 줄(번호·정오·복수정답)과 문제 본문을 분리해 복수정답이어도 본문 정렬이 같다.
  const questionBlock = (q: SubmissionDetail['questionResults'][number], idx: number): Content => {
    const isMulti = q.choices.filter((c) => c.isCorrect).length > 1;
    const st = q.isAnswered === false
      ? { text: '미응답', color: COLOR.none, bg: COLOR.noneBg, line: COLOR.line }
      : q.isCorrect
      ? { text: '정답', color: COLOR.ok, bg: COLOR.okBg, line: COLOR.okLine }
      : { text: '오답', color: COLOR.bad, bg: COLOR.badBg, line: COLOR.badLine };

    const choiceRows: TableCell[][] = q.choices.map((ch) => {
      const wrongPick = ch.isSelected && !ch.isCorrect;
      return [
        { text: ch.isSelected ? '●' : '○', color: ch.isSelected ? COLOR.text : COLOR.faint },
        {
          text: ch.content,
          color: ch.isCorrect ? COLOR.ok : wrongPick ? COLOR.bad : COLOR.sub,
          bold: ch.isCorrect,
          decoration: wrongPick ? 'lineThrough' : undefined,
        },
        {
          text: ch.isCorrect ? '정답' : wrongPick ? '선택 오답' : '',
          color: ch.isCorrect ? COLOR.ok : COLOR.bad,
          bold: true,
          fontSize: 8,
          alignment: 'right',
        },
      ];
    });

    return {
      unbreakable: true, // 문제 상자가 페이지 중간에서 잘리지 않게
      margin: [0, 0, 0, 7],
      table: {
        widths: ['*'],
        body: [[
          {
            fillColor: st.bg,
            stack: [
              {
                text: [
                  { text: `Q${idx + 1}`, bold: true, color: COLOR.text },
                  { text: '    ' },
                  { text: st.text, bold: true, color: st.color },
                  ...(isMulti ? [{ text: '   ·   복수정답', color: COLOR.accent }] : []),
                ],
                fontSize: 8.5,
                margin: [0, 0, 0, 3],
              },
              { text: q.content, bold: true, color: COLOR.text, margin: [0, 0, 0, 5] },
              {
                table: { widths: [10, '*', 42], body: choiceRows },
                layout: {
                  hLineWidth: () => 0,
                  vLineWidth: () => 0,
                  paddingLeft: () => 0,
                  paddingRight: (i: number) => (i === 2 ? 0 : 4),
                  paddingTop: () => 1.5,
                  paddingBottom: () => 1.5,
                },
              },
            ],
          },
        ]],
      },
      layout: {
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        hLineColor: () => st.line,
        vLineColor: () => st.line,
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
    };
  };

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 44],
    info: { title: resultPdfFileName(d).replace(/\.pdf$/, ''), author: '클라우드스퀘어(주) 모의시험 사이트' },
    defaultStyle: { font: 'NanumGothic', fontSize: 9.5, lineHeight: 1.25, color: COLOR.text },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${d.user?.name ?? ''}  ·  ${d.exam.title}`, color: COLOR.faint },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: COLOR.faint, width: 50 },
      ],
      fontSize: 7.5,
      margin: [40, 14, 40, 0],
    }),
    content: [
      { text: '시험 결과서', fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 3] },
      { text: '클라우드스퀘어(주) 모의시험 사이트', fontSize: 8.5, color: COLOR.faint, alignment: 'center', margin: [0, 0, 0, 14] },
      infoTable,
      {
        columns: [
          { text: '문제별 결과', bold: true, fontSize: 11, width: 'auto' },
          {
            text: '● 응시자 선택    ○ 미선택    정답: 초록색 보기    선택 오답: 빨간 취소선',
            fontSize: 7.5,
            color: COLOR.faint,
            alignment: 'right',
            margin: [0, 3, 0, 0],
          },
        ],
        margin: [0, 16, 0, 7],
      },
      ...qs.map(questionBlock),
      { text: `출력일시: ${printedAt}`, fontSize: 7.5, color: COLOR.faint, alignment: 'right', margin: [0, 6, 0, 0] },
    ],
  };
};

const createResultPdfBlob = async (d: SubmissionDetail): Promise<Blob> => {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(buildDoc(d)).getBlob();
};

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

// 학생 1명 결과서 바로 다운로드
export const downloadResultPdf = async (d: SubmissionDetail) => {
  saveBlob(await createResultPdfBlob(d), resultPdfFileName(d));
};

// 응시 기록 id 로 바로 다운로드 (관리자 응시 결과 목록용)
export const downloadResultPdfById = async (submissionId: string) => {
  await downloadResultPdf(await submissionsApi.getById(submissionId));
};

// 시험 전체 결과서를 학생별 PDF 파일로 만들어 ZIP 하나로 저장
// targets: 응시한 학생들의 대표(최근) 응시 기록. 실패한 학생 이름 목록을 돌려준다.
export const downloadExamResultsZip = async (
  examTitle: string,
  targets: Array<{ submissionId: string; userName: string }>,
  onProgress: (done: number, total: number) => void,
): Promise<{ saved: number; failed: string[] }> => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const usedNames = new Set<string>();
  const failed: string[] = [];
  let saved = 0;

  // 순차 처리 — 서버와 브라우저에 부담을 주지 않는다
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      const d = await submissionsApi.getById(t.submissionId);
      let name = resultPdfFileName(d);
      for (let n = 2; usedNames.has(name); n++) name = resultPdfFileName(d).replace(/\.pdf$/, `_${n}.pdf`);
      usedNames.add(name);
      zip.file(name, await createResultPdfBlob(d));
      saved++;
    } catch {
      failed.push(t.userName);
    }
    onProgress(i + 1, targets.length);
  }

  if (saved > 0) {
    saveBlob(await zip.generateAsync({ type: 'blob' }), `${sanitize(`${examTitle}_결과서`)}.zip`);
  }
  return { saved, failed };
};
