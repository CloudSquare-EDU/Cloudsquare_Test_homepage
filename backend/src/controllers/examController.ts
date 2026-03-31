// examController.ts
// 역할: /exams 요청 처리 — zod 검증 후 examService 호출

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types';
import * as examService from '../services/examService';

const createExamSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.').max(200),
  description: z.string().max(1000).optional(),
  duration: z.number().int().positive('제한 시간은 양수여야 합니다.'),
});

const updateExamSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  duration: z.number().int().positive().optional(),
});

export const getExams = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const exams = isAdmin
      ? await examService.getAllExams()
      : await examService.getPublishedExams();
    res.json({ success: true, data: exams });
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
    const exam = await examService.getExamById(req.params.id);
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
    const exam = await examService.createExam(input);
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
    const exam = await examService.updateExam(req.params.id, input);
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

export const publishExam = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const exam = await examService.publishExam(req.params.id);
    res.json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
};
