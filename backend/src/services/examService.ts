// examService.ts
// 역할: 시험 관련 비즈니스 로직
// 설계 포인트: getExamById 응답에서 Choice.isCorrect를 제외하여 정답 노출 방지

import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

interface CreateExamInput {
  title: string;
  description?: string;
  duration: number;
}

interface UpdateExamInput {
  title?: string;
  description?: string;
  duration?: number;
}

// 공개된 시험 목록 조회 (USER용)
export const getPublishedExams = async () => {
  const exams = await prisma.exam.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { questions: true } },
    },
  });

  return exams.map((exam) => ({
    id: exam.id,
    title: exam.title,
    description: exam.description,
    duration: exam.duration,
    questionCount: exam._count.questions,
    createdAt: exam.createdAt,
  }));
};

// 전체 시험 목록 (ADMIN용)
export const getAllExams = async () => {
  return prisma.exam.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { questions: true, submissions: true } } },
  });
};

// 시험 상세 + 문제 조회 (정답 isCorrect 제외)
export const getExamById = async (id: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: {
          choices: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              content: true,
              order: true,
              // isCorrect 제외: 클라이언트에서 정답 확인 불가
            },
          },
        },
      },
    },
  });

  if (!exam) {
    throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');
  }

  return exam;
};

// 시험 생성 (ADMIN)
export const createExam = async (input: CreateExamInput) => {
  return prisma.exam.create({ data: input });
};

// 시험 수정 (ADMIN)
export const updateExam = async (id: string, input: UpdateExamInput) => {
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  return prisma.exam.update({ where: { id }, data: input });
};

// 시험 삭제 (ADMIN) — Cascade로 Question, Submission도 자동 삭제
export const deleteExam = async (id: string) => {
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  await prisma.exam.delete({ where: { id } });
};

// 시험 공개 처리 (ADMIN)
export const publishExam = async (id: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { _count: { select: { questions: true } } },
  });

  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');
  if (exam._count.questions === 0) {
    throw new AppError(400, ErrorCode.BAD_REQUEST, '문제가 없는 시험은 공개할 수 없습니다.');
  }

  return prisma.exam.update({ where: { id }, data: { isPublished: true } });
};
