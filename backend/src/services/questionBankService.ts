// questionBankService.ts
// 역할: 문제은행 CRUD + 엑셀 일괄 등록 비즈니스 로직

import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

// ── 타입 정의 ──────────────────────────────────────────────────

export interface BankQuestionInput {
  content: string;
  choices: {
    content: string;
    isCorrect: boolean;
    order: number;
  }[];
}

// ── 문제은행 CRUD ───────────────────────────────────────────────

export const getAllBanks = async () => {
  return prisma.questionBank.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { questions: true, exams: true } },
    },
  });
};

export const getBankById = async (id: string) => {
  const bank = await prisma.questionBank.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: {
          choices: { orderBy: { order: 'asc' } },
        },
      },
      _count: { select: { questions: true, exams: true } },
    },
  });
  if (!bank) throw new AppError(404, ErrorCode.NOT_FOUND, '문제은행을 찾을 수 없습니다.');
  return bank;
};

export const createBank = async (name: string, description?: string) => {
  return prisma.questionBank.create({
    data: { name, description },
  });
};

export const updateBank = async (id: string, name: string, description?: string) => {
  const bank = await prisma.questionBank.findUnique({ where: { id } });
  if (!bank) throw new AppError(404, ErrorCode.NOT_FOUND, '문제은행을 찾을 수 없습니다.');
  return prisma.questionBank.update({ where: { id }, data: { name, description } });
};

export const deleteBank = async (id: string) => {
  const bank = await prisma.questionBank.findUnique({ where: { id } });
  if (!bank) throw new AppError(404, ErrorCode.NOT_FOUND, '문제은행을 찾을 수 없습니다.');
  await prisma.questionBank.delete({ where: { id } });
};

// ── 문제 CRUD ──────────────────────────────────────────────────

// 단일 문제 추가
export const addQuestion = async (bankId: string, input: BankQuestionInput) => {
  const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
  if (!bank) throw new AppError(404, ErrorCode.NOT_FOUND, '문제은행을 찾을 수 없습니다.');

  const maxOrder = await prisma.bankQuestion.aggregate({
    where: { questionBankId: bankId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;

  return prisma.bankQuestion.create({
    data: {
      questionBankId: bankId,
      content: input.content,
      order: nextOrder,
      choices: {
        create: input.choices.map((c) => ({
          content: c.content,
          isCorrect: c.isCorrect,
          order: c.order,
        })),
      },
    },
    include: { choices: { orderBy: { order: 'asc' } } },
  });
};

// 단일 문제 수정
export const updateQuestion = async (questionId: string, input: BankQuestionInput) => {
  const question = await prisma.bankQuestion.findUnique({ where: { id: questionId } });
  if (!question) throw new AppError(404, ErrorCode.NOT_FOUND, '문제를 찾을 수 없습니다.');

  // 기존 선택지 삭제 후 재생성
  await prisma.bankChoice.deleteMany({ where: { bankQuestionId: questionId } });

  return prisma.bankQuestion.update({
    where: { id: questionId },
    data: {
      content: input.content,
      choices: {
        create: input.choices.map((c) => ({
          content: c.content,
          isCorrect: c.isCorrect,
          order: c.order,
        })),
      },
    },
    include: { choices: { orderBy: { order: 'asc' } } },
  });
};

// 단일 문제 삭제
export const deleteQuestion = async (questionId: string) => {
  const question = await prisma.bankQuestion.findUnique({ where: { id: questionId } });
  if (!question) throw new AppError(404, ErrorCode.NOT_FOUND, '문제를 찾을 수 없습니다.');
  await prisma.bankQuestion.delete({ where: { id: questionId } });
};

// ── 엑셀 일괄 등록 ─────────────────────────────────────────────
// 엑셀 파싱은 컨트롤러에서 처리, 여기서는 파싱된 배열을 받아 DB에 저장
// 설계: 기존 문제 유지하고 추가 (replace 옵션 있음)

export interface BulkImportResult {
  success: number;
  failed: { row: number; reason: string }[];
}

export const bulkAddQuestions = async (
  bankId: string,
  questions: BankQuestionInput[],
  replace = false,        // true면 기존 문제 전부 삭제 후 새로 등록
): Promise<BulkImportResult> => {
  const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
  if (!bank) throw new AppError(404, ErrorCode.NOT_FOUND, '문제은행을 찾을 수 없습니다.');

  if (replace) {
    await prisma.bankQuestion.deleteMany({ where: { questionBankId: bankId } });
  }

  const currentMax = await prisma.bankQuestion.aggregate({
    where: { questionBankId: bankId },
    _max: { order: true },
  });
  let orderBase = (currentMax._max.order ?? 0) + 1;

  const result: BulkImportResult = { success: 0, failed: [] };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      // 검증
      if (!q.content?.trim()) {
        result.failed.push({ row: i + 2, reason: '문제 내용이 비어있습니다.' });
        continue;
      }
      if (!q.choices || q.choices.length < 2) {
        result.failed.push({ row: i + 2, reason: '선택지가 2개 이상 필요합니다.' });
        continue;
      }
      const correctCount = q.choices.filter((c) => c.isCorrect).length;
      if (correctCount === 0) {
        result.failed.push({ row: i + 2, reason: '정답이 없습니다.' });
        continue;
      }

      await prisma.bankQuestion.create({
        data: {
          questionBankId: bankId,
          content: q.content.trim(),
          order: orderBase++,
          choices: {
            create: q.choices.map((c) => ({
              content: c.content,
              isCorrect: c.isCorrect,
              order: c.order,
            })),
          },
        },
      });
      result.success++;
    } catch {
      result.failed.push({ row: i + 2, reason: '등록 중 오류가 발생했습니다.' });
    }
  }

  return result;
};
