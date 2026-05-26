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
  questionBankId?: string;
  questionCount?: number;
  startDate?: Date | null;
  deadline?: Date | null;
}

interface UpdateExamInput {
  title?: string;
  description?: string;
  duration?: number;
  questionBankId?: string | null;
  questionCount?: number | null;
  startDate?: Date | null;
  deadline?: Date | null;
}

// 해당 사용자에게 할당된 시험 목록 조회 (USER용)
// 1) 직접 UserExam 매핑된 시험
// 2) 사용자가 속한 과정의 시험
// 두 경우 모두 포함 (중복 제거)
export const getAssignedExamsForUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { courseId: true },
  });

  // UserExam 직접 매핑
  const directMappings = await prisma.userExam.findMany({
    where: { userId },
    include: {
      exam: {
        include: {
          _count: { select: { questions: true } },
          course: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const directExamIds = new Set(directMappings.map((m) => m.examId));

  // 과정 기반 시험 (직접 매핑된 것 제외)
  const courseExams = user?.courseId
    ? await prisma.exam.findMany({
        where: {
          courseId: user.courseId,
          id: { notIn: [...directExamIds] },
        },
        include: {
          _count: { select: { questions: true } },
          course: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const toDto = (exam: {
    id: string; title: string; description: string | null; duration: number;
    createdAt: Date; startDate: Date | null; deadline: Date | null;
    _count: { questions: number };
    course: { id: string; name: string } | null;
    questionCount?: number | null;
  }) => ({
    id: exam.id,
    title: exam.title,
    description: exam.description,
    duration: exam.duration,
    questionCount: exam.questionCount ?? exam._count.questions,
    startDate: exam.startDate,
    deadline: exam.deadline,
    createdAt: exam.createdAt,
    course: exam.course,
  });

  return [
    ...directMappings.map((m) => toDto(m.exam)),
    ...courseExams.map(toDto),
  ];
};

// 사용자 시험 목록 + 응시 여부 통합 조회 (USER 홈 화면용)
// 설계 이유: 기존에는 프론트에서 /exams + /submissions 두 번 호출했으나,
//   DB 쿼리를 서버에서 Promise.all로 병렬 실행 후 합쳐서 한 번에 내려줌 (왕복 1회 감소)
export const getAssignedExamsWithSubmissions = async (userId: string) => {
  const [exams, submissions] = await Promise.all([
    getAssignedExamsForUser(userId),
    prisma.submission.findMany({
      where: { userId },
      select: { id: true, examId: true, score: true, totalQuestions: true, submittedAt: true },
    }),
  ]);

  const subMap = new Map(submissions.map((s) => [s.examId, s]));
  return exams.map((exam) => ({
    ...exam,
    submission: subMap.get(exam.id) ?? null,
  }));
};

// 전체 시험 목록 (ADMIN용) — 과정 + 문제은행 정보 포함
export const getAllExams = async (params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}) => {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = params.search
    ? { title: { contains: params.search, mode: 'insensitive' as const } }
    : {};

  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      skip,
      take: limit,
      orderBy: { title: 'asc' },
      include: {
        _count: { select: { questions: true, submissions: true } },
        course: { select: { id: true, name: true } },
        questionBank: { select: { id: true, name: true, _count: { select: { questions: true } } } },
      },
    }),
  ]);

  return {
    data: exams,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// 시험 상세 + 문제 조회
// 설계 포인트:
//   - isCorrect는 DB에서 조회하되 클라이언트에는 노출하지 않음 (정답 노출 방지)
//   - 문제은행 시험: userId가 주어지면 배정된 문제를 assignment 서비스에서 가져옴
//   - 수동 문제 시험: 기존 방식 유지
export const getExamById = async (id: string, userId?: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: {
          choices: { orderBy: { order: 'asc' } },
        },
      },
      questionBank: { select: { id: true, name: true } },
    },
  });

  if (!exam) {
    throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');
  }

  // 시작일/마감일 체크 (userId가 있을 때만 — 관리자는 제외)
  if (userId && exam.startDate && new Date() < exam.startDate) {
    throw new AppError(403, ErrorCode.FORBIDDEN, '아직 응시 시작 전인 시험입니다.');
  }
  if (userId && exam.deadline && new Date() > exam.deadline) {
    throw new AppError(403, ErrorCode.FORBIDDEN, '응시 기간이 종료된 시험입니다.');
  }

  // 문제은행 기반 시험: userId가 있으면 배정 문제 로드
  if (exam.questionBankId && userId) {
    const { getOrCreateAssignment } = await import('./userExamAssignmentService');
    const assignedQuestions = await getOrCreateAssignment(userId, id);
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      duration: exam.duration,
      isPublished: exam.isPublished,
      courseId: exam.courseId,
      questionBankId: exam.questionBankId,
      questionCount: exam.questionCount,
      startDate: exam.startDate,
      deadline: exam.deadline,
      questionBank: exam.questionBank,
      questions: assignedQuestions ?? [],
      isBankBased: true,
    };
  }

  // 수동 문제 시험 (기존 방식)
  return {
    ...exam,
    startDate: exam.startDate,
    deadline: exam.deadline,
    isBankBased: false,
    questions: exam.questions.map((q) => ({
      ...q,
      answerCount: q.choices.filter((c) => c.isCorrect).length,
      choices: q.choices.map(({ isCorrect: _removed, ...rest }) => rest),
    })),
  };
};

// 시험 생성 (ADMIN)
export const createExam = async (input: CreateExamInput) => {
  return prisma.exam.create({
    data: {
      title: input.title,
      description: input.description,
      duration: input.duration,
      questionBankId: input.questionBankId ?? null,
      questionCount: input.questionCount ?? null,
      startDate: input.startDate ?? null,
      deadline: input.deadline ?? null,
    },
  });
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

  return prisma.exam.update({
    where: { id },
    data: { isPublished: true },
  });
};

// 시험 비공개 처리 (ADMIN)
export const unpublishExam = async (id: string) => {
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  return prisma.exam.update({
    where: { id },
    data: { isPublished: false },
  });
};
