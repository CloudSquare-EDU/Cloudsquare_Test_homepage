// submissionService.ts
// 역할: 시험 제출 + 즉시 채점 비즈니스 로직
// 설계 포인트:
//   - 제출 시 DB에서 정답을 조회하고 채점한 뒤 결과를 단일 트랜잭션으로 저장
//   - isPublished 여부와 무관하게 UserExam 할당 여부만으로 응시 권한 결정
//   - 동일 시험 중복 응시 차단 (관리자가 reset하기 전까지 재응시 불가)

import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

interface AnswerInput {
  questionId: string;
  choiceId: string;
}

interface SubmitInput {
  userId: string;
  examId: string;
  answers: AnswerInput[];
}

// 시험 제출 + 즉시 채점
export const submitExam = async (input: SubmitInput) => {
  const { userId, examId, answers } = input;

  // 1. 시험 존재 확인 (isPublished 조건 제거 — 할당 방식으로만 접근 제어)
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        include: { choices: true },
      },
    },
  });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  // 2. 사용자에게 이 시험이 할당되어 있는지 확인
  const assignment = await prisma.userExam.findUnique({
    where: { userId_examId: { userId, examId } },
  });
  if (!assignment) {
    throw new AppError(403, ErrorCode.FORBIDDEN, '이 시험에 대한 응시 권한이 없습니다.');
  }

  // 3. 중복 응시 차단 — 이미 제출 기록이 있으면 거부
  const existingSubmission = await prisma.submission.findFirst({
    where: { userId, examId },
  });
  if (existingSubmission) {
    throw new AppError(
      409,
      ErrorCode.CONFLICT,
      '이미 응시한 시험입니다. 재응시하려면 관리자에게 문의하세요.',
    );
  }

  const totalQuestions = exam.questions.length;

  // 4. 제출 답안 수와 문제 수 일치 여부 확인
  if (answers.length !== totalQuestions) {
    throw new AppError(
      400,
      ErrorCode.BAD_REQUEST,
      `모든 문제에 답해야 합니다. (${totalQuestions}개 필요, ${answers.length}개 제출)`,
    );
  }

  // 5. 채점: 각 답안의 정답 여부 계산
  const gradedAnswers = answers.map((answer) => {
    const question = exam.questions.find((q) => q.id === answer.questionId);
    if (!question) {
      throw new AppError(400, ErrorCode.BAD_REQUEST, `유효하지 않은 questionId: ${answer.questionId}`);
    }
    const choice = question.choices.find((c) => c.id === answer.choiceId);
    if (!choice) {
      throw new AppError(400, ErrorCode.BAD_REQUEST, `유효하지 않은 choiceId: ${answer.choiceId}`);
    }
    return {
      questionId: answer.questionId,
      choiceId: answer.choiceId,
      isCorrect: choice.isCorrect,
      correctChoiceId: question.choices.find((c) => c.isCorrect)?.id ?? '',
    };
  });

  const correctCount = gradedAnswers.filter((a) => a.isCorrect).length;
  const score = Math.round((correctCount / totalQuestions) * 100);

  // 6. 트랜잭션으로 Submission + Answer 동시 저장
  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: {
        userId,
        examId,
        score,
        totalQuestions,
        answers: {
          create: gradedAnswers.map((a) => ({
            questionId: a.questionId,
            choiceId: a.choiceId,
            isCorrect: a.isCorrect,
          })),
        },
      },
      include: {
        answers: {
          include: {
            question: { select: { id: true, content: true } },
            choice: { select: { id: true, content: true } },
          },
        },
      },
    });
    return created;
  });

  return {
    submissionId: submission.id,
    score,
    totalQuestions,
    correctCount,
    answers: submission.answers.map((a) => ({
      questionId: a.questionId,
      choiceId: a.choiceId,
      isCorrect: a.isCorrect,
      correctChoiceId: gradedAnswers.find((g) => g.questionId === a.questionId)?.correctChoiceId,
    })),
  };
};

// 내 응시 목록 조회
export const getMySubmissions = async (userId: string) => {
  return prisma.submission.findMany({
    where: { userId },
    orderBy: { submittedAt: 'desc' },
    include: {
      exam: { select: { id: true, title: true } },
    },
  });
};

// 응시 결과 상세 조회
export const getSubmissionById = async (id: string, userId: string, isAdmin: boolean) => {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      exam: { select: { id: true, title: true, duration: true } },
      answers: {
        include: {
          question: {
            include: {
              choices: {
                orderBy: { order: 'asc' },
              },
            },
          },
          choice: { select: { id: true, content: true } },
        },
      },
    },
  });

  if (!submission) throw new AppError(404, ErrorCode.NOT_FOUND, '응시 기록을 찾을 수 없습니다.');

  // 본인 응시 기록만 조회 가능 (관리자는 전체 조회 가능)
  if (!isAdmin && submission.userId !== userId) {
    throw new AppError(403, ErrorCode.FORBIDDEN, '접근 권한이 없습니다.');
  }

  return submission;
};

// 전체 응시 결과 조회 (ADMIN)
export const getAllSubmissions = async () => {
  return prisma.submission.findMany({
    orderBy: { submittedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      exam: { select: { id: true, title: true } },
    },
  });
};

// 특정 사용자의 응시 현황 조회 (ADMIN) — 할당된 시험 + 응시 여부 포함
export const getSubmissionsByUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.');

  const assignments = await prisma.userExam.findMany({
    where: { userId },
    include: {
      exam: { select: { id: true, title: true, duration: true } },
    },
  });

  const submissions = await prisma.submission.findMany({
    where: { userId },
    select: { id: true, examId: true, score: true, totalQuestions: true, submittedAt: true },
  });

  const submissionMap = new Map(submissions.map((s) => [s.examId, s]));

  return {
    user,
    exams: assignments.map((a) => {
      const sub = submissionMap.get(a.examId) ?? null;
      return {
        examId: a.exam.id,
        examTitle: a.exam.title,
        duration: a.exam.duration,
        submitted: !!sub,
        submission: sub,
      };
    }),
  };
};

// 특정 시험의 응시 현황 조회 (ADMIN) — 할당된 사용자 + 응시 여부 포함
export const getSubmissionsByExam = async (examId: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, duration: true },
  });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  // 이 시험에 할당된 사용자 목록
  const assignments = await prisma.userExam.findMany({
    where: { examId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // 이 시험의 제출 목록
  const submissions = await prisma.submission.findMany({
    where: { examId },
    select: { id: true, userId: true, score: true, totalQuestions: true, submittedAt: true },
  });

  const submissionMap = new Map(submissions.map((s) => [s.userId, s]));

  return {
    exam,
    users: assignments.map((a) => {
      const sub = submissionMap.get(a.userId) ?? null;
      return {
        userId: a.user.id,
        userName: a.user.name,
        userEmail: a.user.email,
        submitted: !!sub,
        submission: sub,
      };
    }),
  };
};

// 관리자: 재응시 허용 — 특정 submission 삭제
export const resetSubmission = async (submissionId: string) => {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new AppError(404, ErrorCode.NOT_FOUND, '응시 기록을 찾을 수 없습니다.');
  await prisma.submission.delete({ where: { id: submissionId } });
};
