// examController.ts
// 역할: /exams 요청 처리 — zod 검증 후 examService 호출

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types';
import * as examService from '../services/examService';

const createExamSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.').max(200),
  description: z.string().max(1000).optional(),
  duration: z.number().int().min(0, '제한 시간은 0 이상이어야 합니다.'),
  examType: z.enum(['SELF_STUDY', 'REAL_EXAM']).optional(),
  questionBankId: z.string().optional(),
  questionCount: z.number().int().positive().optional(),
  startDate: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

const updateExamSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  duration: z.number().int().min(0).optional(),
  examType: z.enum(['SELF_STUDY', 'REAL_EXAM']).optional(),
  questionBankId: z.string().nullable().optional(),
  questionCount: z.number().int().positive().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

// GET /exams/my — 사용자 시험 목록 + 응시 상태 통합 반환 (홈 화면 단일 호출용)
export const getMyExams = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) throw new Error('인증 필요');
    const data = await examService.getAssignedExamsWithSubmissions(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getExams = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    if (isAdmin) {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const search = (req.query['search'] as string) || undefined;
      const result = await examService.getAllExams({ page, limit, search });
      res.json({ success: true, data: result });
    } else {
      const exams = await examService.getAssignedExamsForUser(req.user!.userId);
      res.json({ success: true, data: exams });
    }
  } catch (err) {
    next(err);
  }
};

export const getExamById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 문제은행 기반 시험이면 userId 전달 → 배정 문제 반환
    const userId = req.user?.userId;
    const exam = await examService.getExamById(req.params.id, userId);
    res.json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
};

// POST /exams/:id/retake — 재응시 시작: 새 회차 문제를 추첨해서 시험 정보를 반환
export const startRetake = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const exam = await examService.getExamById(req.params.id, req.user!.userId, { retake: true });
    res.json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
};

export const createExam = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createExamSchema.parse(req.body);
    const exam = await examService.createExam({
      ...input,
      startDate: input.startDate ? new Date(input.startDate) : null,
      deadline: input.deadline ? new Date(input.deadline) : null,
    });
    res.status(201).json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
};

export const updateExam = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateExamSchema.parse(req.body);
    const exam = await examService.updateExam(req.params.id, {
      ...input,
      startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
      deadline: input.deadline !== undefined ? (input.deadline ? new Date(input.deadline) : null) : undefined,
    });
    res.json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
};

export const deleteExam = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await examService.deleteExam(req.params.id);
    res.json({ success: true, data: { message: '시험이 삭제되었습니다.' } });
  } catch (err) {
    next(err);
  }
};

