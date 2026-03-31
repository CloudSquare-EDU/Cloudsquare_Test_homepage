// submissionService.ts
// 역할: 시험 제출 + 즉시 채점 비즈니스 로직
// 설계 포인트: 제출 시 DB에서 정답을 조회하고 채점한 뒤 결과를 단일 트랜잭션으로 저장

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

  // 시험 존재 확인
  const exam = await prisma.exam.findUnique({
    where: { id: examId, isPublished: true },
    include: {
      questions: {
        include: { choices: true },
      },
    },
  });

  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  const totalQuestions = exam.questions.length;

  // 제출 답안 수와 문제 수 일치 여부 확인
  if (answers.length !== totalQuestions) {
    throw new AppError(
      400,
      ErrorCode.BAD_REQUEST,
      `모든 문제에 답해야 합니다. (${totalQuestions}개 필요, ${answers.length}개 제출)`,
    );
  }

  // 채점: 각 답안의 정답 여부 계산
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

  // 트랜잭션으로 Submission + Answer 동시 저장
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

  // 응답에 채점 결과 포함 (correctChoiceId 추가)
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
