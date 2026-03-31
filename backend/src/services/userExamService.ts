// userExamService.ts
// 역할: 시험-사용자 매핑 비즈니스 로직
// - 특정 시험에 사용자 할당 / 해제
// - 특정 사용자에게 할당된 시험 목록 조회
// - 특정 시험에 할당된 사용자 목록 조회

import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

// 시험에 사용자 할당
export const assignUserToExam = async (examId: string, userId: string) => {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.');

  // 이미 할당된 경우 무시 (upsert)
  return prisma.userExam.upsert({
    where: { userId_examId: { userId, examId } },
    create: { userId, examId },
    update: {},
    include: {
      user: { select: { id: true, name: true, email: true } },
      exam: { select: { id: true, title: true } },
    },
  });
};

// 시험에서 사용자 할당 해제
export const removeUserFromExam = async (examId: string, userId: string) => {
  const mapping = await prisma.userExam.findUnique({
    where: { userId_examId: { userId, examId } },
  });
  if (!mapping) throw new AppError(404, ErrorCode.NOT_FOUND, '할당 정보를 찾을 수 없습니다.');

  await prisma.userExam.delete({
    where: { userId_examId: { userId, examId } },
  });
};

// 특정 시험에 할당된 사용자 목록
export const getUsersByExam = async (examId: string) => {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  const mappings = await prisma.userExam.findMany({
    where: { examId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return mappings.map((m) => m.user);
};

// 특정 사용자에게 할당된 시험 목록 (일반 유저 시험 목록에 사용)
export const getExamsByUser = async (userId: string) => {
  const mappings = await prisma.userExam.findMany({
    where: { userId },
    include: {
      exam: {
        include: { _count: { select: { questions: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return mappings
    .filter((m) => m.exam.isPublished)
    .map((m) => ({
      id: m.exam.id,
      title: m.exam.title,
      description: m.exam.description,
      duration: m.exam.duration,
      questionCount: m.exam._count.questions,
      createdAt: m.exam.createdAt,
    }));
};
