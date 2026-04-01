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

// 해당 사용자에게 할당된 공개 시험 목록 조회 (USER용)
// UserExam 매핑이 없으면 빈 배열 반환
export const getAssignedExamsForUser = async (userId: string) => {
  const mappings = await prisma.userExam.findMany({
    where: { userId },
    include: {
      exam: {
        include: { _count: { select: { questions: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 관리자가 명시적으로 할당한 시험은 isPublished 여부와 무관하게 표시
  return mappings.map((m) => ({
    id: m.exam.id,
    title: m.exam.title,
    description: m.exam.description,
    duration: m.exam.duration,
    questionCount: m.exam._count.questions,
    createdAt: m.exam.createdAt,
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

// 시험 삭제 (ADMIN)
// 설계 이유: Answer 테이블이 Question/Choice를 FK 참조하지만 Cascade가 없어서
//   단순 exam.delete() 시 FK 위반 에러 발생.
//   트랜잭션으로 삭제 순서를 직접 제어하여 해결.
export const deleteExam = async (id: string) => {
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  await prisma.$transaction(async (tx) => {
    // 1. 이 시험의 Submission ID 목록 조회
    const submissions = await tx.submission.findMany({
      where: { examId: id },
      select: { id: true },
    });
    const submissionIds = submissions.map((s) => s.id);

    // 2. Answer 삭제 (Submission FK + Question FK 모두 해소)
    if (submissionIds.length > 0) {
      await tx.answer.deleteMany({ where: { submissionId: { in: submissionIds } } });
    }

    // 3. Submission 삭제
    await tx.submission.deleteMany({ where: { examId: id } });

    // 4. UserExam 매핑 삭제
    await tx.userExam.deleteMany({ where: { examId: id } });

    // 5. 이 시험의 Question ID 목록 조회 후 Choice 삭제
    const questions = await tx.question.findMany({
      where: { examId: id },
      select: { id: true },
    });
    const questionIds = questions.map((q) => q.id);

    if (questionIds.length > 0) {
      await tx.choice.deleteMany({ where: { questionId: { in: questionIds } } });
    }

    // 6. Question 삭제
    await tx.question.deleteMany({ where: { examId: id } });

    // 7. Exam 삭제
    await tx.exam.delete({ where: { id } });
  });
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
