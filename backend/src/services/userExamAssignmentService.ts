// userExamAssignmentService.ts
// 역할: 사용자별 문제 랜덤 배정 (문제은행 기반 시험)
//
// 흐름:
//   1. 사용자가 시험에 처음 접근하면 getOrCreateAssignment 호출
//   2. 이미 배정된 문제가 있으면 그대로 반환
//   3. 없으면 문제은행에서 questionCount개 랜덤 추첨 → UserExamQuestion에 저장
//   4. 재응시(자기주도학습 + 과정 allowRetake)는 attemptNo를 하나 올려 새로 추첨하고,
//      이전 회차의 문제 세트는 그대로 보관한다 (회차별 결과 화면에서 그때 풀었던 문제를 그대로 보여주기 위함)
//   5. 관리자가 응시 기록을 초기화(resetSubmission)하면 해당 회차의 배정도 함께 삭제

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

// 이 사용자의 가장 최근 응시 회차 (응시 기록이 없으면 0)
export const getLatestAttemptNo = async (userId: string, examId: string): Promise<number> => {
  const agg = await prisma.submission.aggregate({
    where: { userId, examId },
    _max: { attemptNo: true },
  });
  return agg._max.attemptNo ?? 0;
};

// 재응시 허용 여부: 자기주도학습(SELF_STUDY) 시험이고, 시험이 속한 과정(없으면 사용자의 과정)의 allowRetake 가 켜져 있을 때만 허용
// 실제시험(REAL_EXAM)은 과정 설정과 무관하게 항상 1회만 응시 (재응시는 관리자의 '재응시 허용(기록 초기화)'로만 가능)
export const isRetakeAllowed = async (userId: string, examId: string): Promise<boolean> => {
  const [exam, user] = await Promise.all([
    prisma.exam.findUnique({
      where: { id: examId },
      select: { examType: true, course: { select: { allowRetake: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { course: { select: { allowRetake: true } } },
    }),
  ]);
  if (!exam || exam.examType !== 'SELF_STUDY') return false;
  return (exam.course?.allowRetake ?? user?.course?.allowRetake) === true;
};

// 사용자에게 배정된 문제 조회 또는 신규 배정
// attemptNo 를 생략하면 "현재 회차"를 사용한다: 응시 기록이 없으면 1회차, 있으면 가장 최근 응시한 회차
//   (재응시를 시작할 때만 최근 회차 + 1 을 명시적으로 넘겨 새로 추첨한다)
export const getOrCreateAssignment = async (userId: string, examId: string, attemptNo?: number) => {
  const attempt = attemptNo ?? Math.max(1, await getLatestAttemptNo(userId, examId));

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
    where: { userId, examId, attemptNo: attempt },
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
  const pickedWithOrder = picked.map((q, idx) => ({ bankQuestionId: q.id, assignedOrder: idx + 1 }));
  await prisma.userExamQuestion.createMany({
    data: pickedWithOrder.map(({ bankQuestionId, assignedOrder }) => ({
      userId,
      examId,
      attemptNo: attempt,
      bankQuestionId,
      assignedOrder,
    })),
  });

  // createMany는 생성된 레코드를 반환하지 않으므로,
  // picked ID 목록으로 최소한의 쿼리 1회만 실행 (전체 테이블 재조회 방지)
  const pickedIds = pickedWithOrder.map((p) => p.bankQuestionId);
  const questions = await prisma.bankQuestion.findMany({
    where: { id: { in: pickedIds } },
    include: { choices: { orderBy: { order: 'asc' } } },
  });

  // DB 반환 순서가 보장되지 않으므로 Map으로 O(1) 정렬
  const qMap = new Map(questions.map((q) => [q.id, q]));

  return pickedWithOrder.map(({ bankQuestionId, assignedOrder }) => {
    const q = qMap.get(bankQuestionId)!;
    return {
      id: q.id,
      content: q.content,
      order: assignedOrder,
      choices: q.choices.map(({ isCorrect: _removed, ...rest }) => rest),
      answerCount: q.choices.filter((c) => c.isCorrect).length,
    };
  });
};

// 배정 초기화 — submissionService.resetSubmission에서 함께 호출
// attemptNo 를 주면 그 회차의 배정만 삭제 (다른 회차의 기록은 보존)
export const resetAssignment = async (userId: string, examId: string, attemptNo?: number) => {
  await prisma.userExamQuestion.deleteMany({
    where: { userId, examId, ...(attemptNo !== undefined ? { attemptNo } : {}) },
  });
};

// 관리자용: 특정 사용자의 배정 문제 전체 조회 (정답 포함)
// attemptNo 를 생략하면 가장 최근 회차의 배정을 반환
export const getAdminUserAssignment = async (userId: string, examId: string, attemptNo?: number) => {
  let attempt = attemptNo;
  if (attempt === undefined) {
    const agg = await prisma.userExamQuestion.aggregate({
      where: { userId, examId },
      _max: { attemptNo: true },
    });
    attempt = agg._max.attemptNo ?? 1;
  }
  const assigned = await prisma.userExamQuestion.findMany({
    where: { userId, examId, attemptNo: attempt },
    orderBy: { assignedOrder: 'asc' },
    include: {
      bankQuestion: {
        include: { choices: { orderBy: { order: 'asc' } } },
      },
    },
  });

  return assigned.map((ueq) => ({
    order: ueq.assignedOrder,
    id: ueq.bankQuestion.id,
    content: ueq.bankQuestion.content,
    choices: ueq.bankQuestion.choices.map((c) => ({
      id: c.id,
      content: c.content,
      isCorrect: c.isCorrect, // 관리자는 정답 표시
      order: c.order,
    })),
  }));
};
