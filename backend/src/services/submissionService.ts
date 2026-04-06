// submissionService.ts
// 역할: 시험 제출 + 즉시 채점 비즈니스 로직
// 설계 포인트:
//   - 수동 문제 시험: Question/Choice 기반 채점 (기존)
//   - 문제은행 시험: BankQuestion/BankChoice 기반 채점 (신규)
//   - 동일 시험 중복 응시 차단 (관리자가 reset하기 전까지 재응시 불가)
//   - 재응시 시 UserExamQuestion도 함께 초기화

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

  // 1. 시험 존재 확인
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: { include: { choices: true } },
    },
  });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  // 2. 응시 권한 확인: UserExam 직접 할당 OR 과정(course) 기반 접근
  const [directAssignment, user] = await Promise.all([
    prisma.userExam.findUnique({ where: { userId_examId: { userId, examId } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { courseId: true } }),
  ]);

  const hasDirectAccess = !!directAssignment;
  const hasCourseAccess = !!(user?.courseId && exam.courseId && user.courseId === exam.courseId);
  const isBankBased = !!exam.questionBankId;

  // 문제은행 기반 시험은 과정 접근 또는 직접 할당 모두 허용
  if (!hasDirectAccess && !hasCourseAccess) {
    throw new AppError(403, ErrorCode.FORBIDDEN, '이 시험에 대한 응시 권한이 없습니다.');
  }

  // 3. 중복 응시 차단
  const existingSubmission = await prisma.submission.findFirst({ where: { userId, examId } });
  if (existingSubmission) {
    throw new AppError(409, ErrorCode.CONFLICT, '이미 응시한 시험입니다. 재응시하려면 관리자에게 문의하세요.');
  }

  // ── 문제은행 기반 채점 ────────────────────────────────────────
  if (isBankBased) {
    // 사용자에게 배정된 bankQuestionId 목록 확인
    const assigned = await prisma.userExamQuestion.findMany({
      where: { userId, examId },
      include: {
        bankQuestion: { include: { choices: true } },
      },
    });

    if (assigned.length === 0) {
      throw new AppError(400, ErrorCode.BAD_REQUEST, '배정된 문제가 없습니다. 시험 페이지를 먼저 열어주세요.');
    }

    const totalQuestions = assigned.length;
    // 미응답 허용 (타이머 만료 시 부분 제출 가능)

    // O(1) 조회를 위한 Map 생성 (기존 O(n²) Array.find 루프 제거)
    const assignedMap = new Map(assigned.map((a) => [a.bankQuestionId, a]));

    type BankAnswerRecord = {
      bankQuestionId: string; bankChoiceId: string; isCorrect: boolean;
    };
    const gradedAnswerRecords: BankAnswerRecord[] = [];
    let correctCount = 0;
    const questionResultMap: Record<string, { isCorrect: boolean; correctChoiceIds: string[] }> = {};

    for (const answer of answers) {
      const ueq = assignedMap.get(answer.questionId);
      if (!ueq) {
        throw new AppError(400, ErrorCode.BAD_REQUEST, `배정되지 않은 문제입니다: ${answer.questionId}`);
      }
      const q = ueq.bankQuestion;

      for (const cId of answer.choiceIds) {
        if (!q.choices.some((c) => c.id === cId)) {
          throw new AppError(400, ErrorCode.BAD_REQUEST, `유효하지 않은 선택지: ${cId}`);
        }
      }

      const correctChoiceIds = q.choices.filter((c) => c.isCorrect).map((c) => c.id);
      const selectedSet = new Set(answer.choiceIds);
      const correctSet = new Set(correctChoiceIds);
      const isQuestionCorrect =
        selectedSet.size === correctSet.size && [...correctSet].every((id) => selectedSet.has(id));

      if (isQuestionCorrect) correctCount++;
      questionResultMap[answer.questionId] = { isCorrect: isQuestionCorrect, correctChoiceIds };

      for (const choiceId of answer.choiceIds) {
        gradedAnswerRecords.push({ bankQuestionId: answer.questionId, bankChoiceId: choiceId, isCorrect: isQuestionCorrect });
      }
    }

    const score = Math.round((correctCount / totalQuestions) * 100);

    const submission = await prisma.$transaction(async (tx) => {
      return tx.submission.create({
        data: {
          userId, examId, score, totalQuestions,
          answers: {
            create: gradedAnswerRecords.map((a) => ({
              bankQuestionId: a.bankQuestionId,
              bankChoiceId: a.bankChoiceId,
              isCorrect: a.isCorrect,
            })),
          },
        },
      });
    });

    return {
      submissionId: submission.id,
      score,
      totalQuestions,
      correctCount,
      answers: Object.entries(questionResultMap).map(([questionId, r]) => ({
        questionId,
        choiceIds: gradedAnswerRecords.filter((a) => a.bankQuestionId === questionId).map((a) => a.bankChoiceId),
        isCorrect: r.isCorrect,
        correctChoiceIds: r.correctChoiceIds,
      })),
    };
  }

  // ── 수동 문제 채점 (기존) ──────────────────────────────────────
  const totalQuestions = exam.questions.length;
  // 미응답 허용 (타이머 만료 시 부분 제출 가능)

  // O(1) 조회를 위한 Map 생성
  const questionMap = new Map(exam.questions.map((q) => [q.id, q]));

  type ManualAnswerRecord = { questionId: string; choiceId: string; isCorrect: boolean };
  const gradedAnswerRecords: ManualAnswerRecord[] = [];
  let correctCount = 0;
  const questionResultMap: Record<string, { isCorrect: boolean; correctChoiceIds: string[] }> = {};

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      throw new AppError(400, ErrorCode.BAD_REQUEST, `유효하지 않은 questionId: ${answer.questionId}`);
    }
    const choiceSet = new Set(question.choices.map((c) => c.id));
    for (const choiceId of answer.choiceIds) {
      if (!choiceSet.has(choiceId)) {
        throw new AppError(400, ErrorCode.BAD_REQUEST, `유효하지 않은 choiceId: ${choiceId}`);
      }
    }
    const correctChoiceIds = question.choices.filter((c) => c.isCorrect).map((c) => c.id);
    const selectedSet = new Set(answer.choiceIds);
    const correctSet = new Set(correctChoiceIds);
    const isQuestionCorrect =
      selectedSet.size === correctSet.size && [...correctSet].every((id) => selectedSet.has(id));

    if (isQuestionCorrect) correctCount++;
    questionResultMap[answer.questionId] = { isCorrect: isQuestionCorrect, correctChoiceIds };

    for (const choiceId of answer.choiceIds) {
      gradedAnswerRecords.push({ questionId: answer.questionId, choiceId, isCorrect: isQuestionCorrect });
    }
  }

  const score = Math.round((correctCount / totalQuestions) * 100);

  const submission = await prisma.$transaction(async (tx) => {
    return tx.submission.create({
      data: {
        userId, examId, score, totalQuestions,
        answers: {
          create: gradedAnswerRecords.map((a) => ({
            questionId: a.questionId,
            choiceId: a.choiceId,
            isCorrect: a.isCorrect,
          })),
        },
      },
    });
  });

  const answersByQuestion = new Map<string, string[]>();
  for (const a of gradedAnswerRecords) {
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

// 특정 시험의 내 응시 여부 단일 확인 (기존 getMy() 전체 로드 대체)
// 설계 이유: 시험 응시 페이지 진입 시 기존에는 전체 submission 목록을 내려받아 클라이언트에서 filter했으나,
//   이 엔드포인트로 단건 DB 조회만 수행 → 응시 이력이 많아도 일정한 속도 유지
export const checkMySubmissionForExam = async (userId: string, examId: string) => {
  return prisma.submission.findFirst({
    where: { userId, examId },
    select: {
      id: true,
      score: true,
      totalQuestions: true,
      submittedAt: true,
      exam: { select: { id: true, title: true } },
    },
  });
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
// 설계 포인트: 백엔드에서 answer 레코드를 questionResults 형태로 가공해서 반환
//   → 클라이언트가 answer.question ?? answer.bankQuestion 조인할 필요 없음
export const getSubmissionById = async (id: string, userId: string, isAdmin: boolean) => {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      exam: { select: { id: true, title: true, duration: true } },
      answers: {
        include: {
          question: { include: { choices: { orderBy: { order: 'asc' } } } },
          choice:      { select: { id: true } },
          bankQuestion: { include: { choices: { orderBy: { order: 'asc' } } } },
          bankChoice:   { select: { id: true } },
        },
      },
    },
  });

  if (!submission) throw new AppError(404, ErrorCode.NOT_FOUND, '응시 기록을 찾을 수 없습니다.');

  if (!isAdmin && submission.userId !== userId) {
    throw new AppError(403, ErrorCode.FORBIDDEN, '접근 권한이 없습니다.');
  }

  // ── 문제별로 answer 레코드를 그룹화 ────────────────────────────
  type ChoiceResult = { id: string; content: string; isCorrect: boolean; isSelected: boolean };
  type QuestionResult = { key: string; content: string; isCorrect: boolean; choices: ChoiceResult[] };

  const questionMap = new Map<string, QuestionResult>();

  for (const answer of submission.answers) {
    const q = answer.question ?? answer.bankQuestion;
    const selectedId = answer.choice?.id ?? answer.bankChoice?.id ?? null;
    const key = answer.questionId ?? answer.bankQuestionId ?? null;

    if (!q || !key) continue; // 문제 정보 없으면 스킵

    if (!questionMap.has(key)) {
      const choices: ChoiceResult[] = (q.choices as Array<{ id: string; content: string; isCorrect: boolean }>).map((ch) => ({
        id: ch.id,
        content: ch.content,
        isCorrect: ch.isCorrect,
        isSelected: false,
      }));
      questionMap.set(key, {
        key,
        content: q.content,
        isCorrect: answer.isCorrect,
        choices,
      });
    }

    // 사용자가 선택한 선택지 표시
    if (selectedId) {
      const qr = questionMap.get(key)!;
      const idx = qr.choices.findIndex((ch) => ch.id === selectedId);
      if (idx !== -1) {
        qr.choices[idx] = { ...qr.choices[idx], isSelected: true };
      }
    }
  }

  return {
    id: submission.id,
    exam: submission.exam,
    score: submission.score,
    totalQuestions: submission.totalQuestions,
    submittedAt: submission.submittedAt,
    questionResults: Array.from(questionMap.values()),
  };
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

// 특정 시험의 응시 현황 조회 (ADMIN)
// 설계 포인트:
//   - UserExam 직접 할당 사용자 + 과정(course) 기반 사용자 모두 포함
//   - 응시한 사용자는 미할당이더라도 목록에 표시 (edge case 대응)
export const getSubmissionsByExam = async (examId: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, duration: true, courseId: true },
  });
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');

  // 1) 직접 할당된 사용자
  const directAssignments = await prisma.userExam.findMany({
    where: { examId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // 2) 과정 기반 사용자 (exam.courseId가 있으면 해당 과정에 속한 USER 역할 계정)
  const courseUsers =
    exam.courseId
      ? await prisma.user.findMany({
          where: { courseId: exam.courseId, role: 'USER' },
          select: { id: true, name: true, email: true },
        })
      : [];

  // 3) 이 시험의 제출 목록 (응시한 사람은 무조건 표시)
  // 주의: Prisma에서 include + select 동시 사용 불가 → select만 사용
  const submissions = await prisma.submission.findMany({
    where: { examId },
    select: {
      id: true,
      userId: true,
      score: true,
      totalQuestions: true,
      submittedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // 4) 사용자 목록 통합 (중복 제거 — userId 기준)
  const userMap = new Map<string, { id: string; name: string; email: string }>();

  for (const a of directAssignments) {
    userMap.set(a.user.id, a.user);
  }
  for (const u of courseUsers) {
    userMap.set(u.id, u);
  }
  // 응시한 사람은 할당 여부와 무관하게 포함
  for (const s of submissions) {
    if (!userMap.has(s.userId)) {
      userMap.set(s.userId, s.user);
    }
  }

  const submissionMap = new Map(submissions.map((s) => [s.userId, s]));

  const users = Array.from(userMap.values()).map((u) => {
    const sub = submissionMap.get(u.id) ?? null;
    return {
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      submitted: !!sub,
      submission: sub
        ? {
            id: sub.id,
            score: sub.score,
            totalQuestions: sub.totalQuestions,
            submittedAt: sub.submittedAt,
          }
        : null,
    };
  });

  // 응시 완료한 사람 → 미응시 사람 순으로 정렬
  users.sort((a, b) => {
    if (a.submitted && !b.submitted) return -1;
    if (!a.submitted && b.submitted) return 1;
    return a.userName.localeCompare(b.userName, 'ko', { numeric: true });
  });

  return { exam, users };
};

// 관리자: 재응시 허용 — submission 삭제 + 문제은행 배정 초기화
export const resetSubmission = async (submissionId: string) => {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new AppError(404, ErrorCode.NOT_FOUND, '응시 기록을 찾을 수 없습니다.');

  const { resetAssignment } = await import('./userExamAssignmentService');

  await prisma.$transaction(async (tx) => {
    // Answer 삭제 → Submission 삭제
    await tx.answer.deleteMany({ where: { submissionId } });
    await tx.submission.delete({ where: { id: submissionId } });
  });

  // 문제은행 배정 초기화 (다음 응시 시 새 문제 랜덤 배정)
  await resetAssignment(submission.userId, submission.examId);
};
