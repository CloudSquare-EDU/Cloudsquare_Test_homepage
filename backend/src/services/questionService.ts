// questionService.ts
// 역할: 문제 + 선택지 CRUD 비즈니스 로직
// 설계 포인트: 문제와 선택지를 단일 트랜잭션으로 생성하여 일관성 보장

import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

interface ChoiceInput {
  content: string;
  isCorrect: boolean;
  order: number;
}

interface CreateQuestionInput {
  examId: string;
  content: string;
  order: number;
  choices: ChoiceInput[];
}

interface UpdateQuestionInput {
  content?: string;
  order?: number;
  choices?: ChoiceInput[];
}

// 문제 + 선택지 생성 (트랜잭션)
export const createQuestion = async (input: CreateQuestionInput) => {
  const { examId, content, order, choices } = input;

  // 시험 존재 확인
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  // 정답이 하나 이상 있는지 확인
  const correctCount = choices.filter((c) => c.isCorrect).length;
  if (correctCount !== 1) {
    throw new AppError(400, ErrorCode.BAD_REQUEST, '선택지에 정답이 정확히 하나 있어야 합니다.');
  }

  // 트랜잭션으로 문제 + 선택지 동시 생성
  return prisma.question.create({
    data: {
      examId,
      content,
      order,
      choices: {
        create: choices.map((c) => ({
          content: c.content,
          isCorrect: c.isCorrect,
          order: c.order,
        })),
      },
    },
    include: { choices: { orderBy: { order: 'asc' } } },
  });
};

// 문제 수정 (선택지 포함 시 기존 선택지 삭제 후 재생성)
export const updateQuestion = async (id: string, input: UpdateQuestionInput) => {
  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) throw new AppError(404, ErrorCode.NOT_FOUND, '문제를 찾을 수 없습니다.');

  const { choices, ...rest } = input;

  if (choices) {
    const correctCount = choices.filter((c) => c.isCorrect).length;
    if (correctCount !== 1) {
      throw new AppError(400, ErrorCode.BAD_REQUEST, '선택지에 정답이 정확히 하나 있어야 합니다.');
    }

    // 기존 선택지 삭제 후 새 선택지 생성
    return prisma.$transaction(async (tx) => {
      await tx.choice.deleteMany({ where: { questionId: id } });
      return tx.question.update({
        where: { id },
        data: {
          ...rest,
          choices: { create: choices },
        },
        include: { choices: { orderBy: { order: 'asc' } } },
      });
    });
  }

  return prisma.question.update({
    where: { id },
    data: rest,
    include: { choices: { orderBy: { order: 'asc' } } },
  });
};

// 문제 일괄 생성 (트랜잭션으로 한 번에 처리)
export const bulkCreateQuestions = async (
  examId: string,
  questions: Omit<CreateQuestionInput, 'examId'>[],
) => {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  // 기존 문제 수 조회 (order 이어서 설정)
  const existingCount = await prisma.question.count({ where: { examId } });

  return prisma.$transaction(
    questions.map((q, idx) =>
      prisma.question.create({
        data: {
          examId,
          content: q.content,
          order: existingCount + idx + 1,
          choices: {
            create: q.choices.map((c) => ({
              content: c.content,
              isCorrect: c.isCorrect,
              order: c.order,
            })),
          },
        },
      }),
    ),
  );
};

// 문제 삭제 (Cascade로 Choice, Answer도 자동 삭제)
export const deleteQuestion = async (id: string) => {
  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) throw new AppError(404, ErrorCode.NOT_FOUND, '문제를 찾을 수 없습니다.');

  await prisma.question.delete({ where: { id } });
};
