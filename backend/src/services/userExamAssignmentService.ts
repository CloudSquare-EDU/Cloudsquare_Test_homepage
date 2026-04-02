// userExamAssignmentService.ts
// 역할: 사용자별 문제 랜덤 배정 (문제은행 기반 시험)
//
// 흐름:
//   1. 사용자가 시험에 처음 접근하면 getOrCreateAssignment 호출
//   2. 이미 배정된 문제가 있으면 그대로 반환
//   3. 없으면 문제은행에서 questionCount개 랜덤 추첨 → UserExamQuestion에 저장
//   4. 재응시 시 resetAssignment로 기존 배정 삭제 → 다음 접근 시 새로 추첨

import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

// Fisher-Yates 셔플
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 사용자에게 배정된 문제 조회 또는 신규 배정
export const getOrCreateAssignment = async (userId: string, examId: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      questionBankId: true,
      questionCount: true,
    },
  });

  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  // 문제은행 미사용 시험이면 null 반환 (수동 문제 사용)
  if (!exam.questionBankId) return null;

  // 이미 배정된 문제가 있으면 그대로 반환
  const existing = await prisma.userExamQuestion.findMany({
    where: { userId, examId },
    orderBy: { assignedOrder: 'asc' },
    include: {
      bankQuestion: {
        include: {
          choices: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  if (existing.length > 0) {
    return existing.map((ueq) => ({
      id: ueq.bankQuestion.id,
      content: ueq.bankQuestion.content,
      order: ueq.assignedOrder,
      // isCorrect 제거하여 정답 노출 방지
      choices: ueq.bankQuestion.choices.map(({ isCorrect: _removed, ...rest }) => rest),
      answerCount: ueq.bankQuestion.choices.filter((c) => c.isCorrect).length,
    }));
  }

  // 신규 배정: 문제은행에서 전체 문제 로드 후 랜덤 추첨
  const allQuestions = await prisma.bankQuestion.findMany({
    where: { questionBankId: exam.questionBankId },
    select: { id: true },
  });

  if (allQuestions.length === 0) {
    throw new AppError(400, ErrorCode.BAD_REQUEST, '문제은행에 문제가 없습니다.');
  }

  const pickCount = Math.min(exam.questionCount ?? allQuestions.length, allQuestions.length);
  const picked = shuffle(allQuestions).slice(0, pickCount);

  // UserExamQuestion 일괄 저장
  await prisma.userExamQuestion.createMany({
    data: picked.map((q, idx) => ({
      userId,
      examId,
      bankQuestionId: q.id,
      assignedOrder: idx + 1,
    })),
  });

  // 저장된 문제 상세 반환
  const created = await prisma.userExamQuestion.findMany({
    where: { userId, examId },
    orderBy: { assignedOrder: 'asc' },
    include: {
      bankQuestion: {
        include: {
          choices: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  return created.map((ueq) => ({
    id: ueq.bankQuestion.id,
    content: ueq.bankQuestion.content,
    order: ueq.assignedOrder,
    choices: ueq.bankQuestion.choices.map(({ isCorrect: _removed, ...rest }) => rest),
    answerCount: ueq.bankQuestion.choices.filter((c) => c.isCorrect).length,
  }));
};

// 배정 초기화 (재응시 시 호출)
// submissionService.resetSubmission에서 함께 호출
export const resetAssignment = async (userId: string, examId: string) => {
  await prisma.userExamQuestion.deleteMany({ where: { userId, examId } });
};

// 특정 사용자의 특정 시험 배정 문제 ID 목록 (채점용)
export const getAssignedQuestionIds = async (
  userId: string,
  examId: string,
): Promise<string[]> => {
  const assignments = await prisma.userExamQuestion.findMany({
    where: { userId, examId },
    select: { bankQuestionId: true },
  });
  return assignments.map((a) => a.bankQuestionId);
};
