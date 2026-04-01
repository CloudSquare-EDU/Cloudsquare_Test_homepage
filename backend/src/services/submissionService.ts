// submissionService.ts
// 역할: 시험 제출 + 즉시 채점 비즈니스 로직
// 설계 포인트:
//   - 제출 시 DB에서 정답을 조회하고 채점한 뒤 결과를 단일 트랜잭션으로 저장
//   - isPublished 여부와 무관하게 UserExam 할당 여부만으로 응시 권한 결정
//   - 동일 시험 중복 응시 차단 (관리자가 reset하기 전까지 재응시 불가)
//   - 선다형 지원: choiceIds 배열로 복수 선택, 정답 집합과 정확히 일치해야 정답 처리 (all-or-nothing)

import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

interface AnswerInput {
  questionId: string;
  choiceIds: string[]; // 복수 정답 지원 — 단답형이면 길이 1
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

  // 5. 채점: 선다형 — 선택한 집합이 정답 집합과 정확히 일치해야 정답 (all-or-nothing)
  const gradedAnswerRecords: Array<{ questionId: string; choiceId: string; isCorrect: boolean }> = [];
  let correctCount = 0;
  const questionResultMap: Record<string, { isCorrect: boolean; correctChoiceIds: string[] }> = {};

  for (const answer of answers) {
    const question = exam.questions.find((q) => q.id === answer.questionId);
    if (!question) {
      throw new AppError(400, ErrorCode.BAD_REQUEST, `유효하지 않은 questionId: ${answer.questionId}`);
    }

    // 선택한 모든 choiceId가 이 문제의 선택지인지 확인
    for (const choiceId of answer.choiceIds) {
      const choiceExists = question.choices.some((c) => c.id === choiceId);
      if (!choiceExists) {
        throw new AppError(400, ErrorCode.BAD_REQUEST, `유효하지 않은 choiceId: ${choiceId}`);
      }
    }

    // 이 문제의 정답 집합
    const correctChoiceIds = question.choices.filter((c) => c.isCorrect).map((c) => c.id);
    const selectedSet = new Set(answer.choiceIds);
    const correctSet = new Set(correctChoiceIds);

    // 선택 집합 == 정답 집합이어야 정답
    const isQuestionCorrect =
      selectedSet.size === correctSet.size &&
      [...correctSet].every((id) => selectedSet.has(id));

    if (isQuestionCorrect) correctCount++;

    questionResultMap[answer.questionId] = { isCorrect: isQuestionCorrect, correctChoiceIds };

    // 선택한 각 choiceId마다 Answer 레코드 1개씩 생성 (복수 선택 지원)
    for (const choiceId of answer.choiceIds) {
      gradedAnswerRecords.push({
        questionId: answer.questionId,
        choiceId,
        isCorrect: isQuestionCorrect,
      });
    }
  }

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
          create: gradedAnswerRecords.map((a) => ({
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

  // 응답: questionId 기준으로 그룹핑하여 선택한 choiceIds 목록 반환
  const answersByQuestion = new Map<string, string[]>();
  for (const a of submission.answers) {
    const ids = answersByQuestion.get(a.questionId) ?? [];
    ids.push(a.choiceId);
    answersByQuestion.set(a.questionId, ids);
  }

  return {
    submissionId: submission.id,
    score,
    totalQuestions,
    correctCount,
    answers: Array.from(answersByQuestion.entries()).map(([questionId, choiceIds]) => ({
      questionId,
      choiceIds,
      isCorrect: questionResultMap[questionId]?.isCorrect ?? false,
      correctChoiceIds: questionResultMap[questionId]?.correctChoiceIds ?? [],
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
