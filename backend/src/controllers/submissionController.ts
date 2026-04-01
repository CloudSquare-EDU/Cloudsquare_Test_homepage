// submissionController.ts
// 역할: /submissions 요청 처리

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest, ErrorCode } from '../types';
import { AppError } from '../middlewares/errorHandler';
import * as submissionService from '../services/submissionService';

const submitSchema = z.object({
  examId: z.string().min(1, 'examId가 필요합니다.'),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        choiceId: z.string().min(1),
      }),
    )
    .min(1, '최소 하나 이상의 답안이 필요합니다.'),
});

export const submitExam = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, ErrorCode.UNAUTHORIZED, '인증이 필요합니다.');
    const input = submitSchema.parse(req.body);
    const result = await submissionService.submitExam({
      userId: req.user.userId,
      ...input,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getMySubmissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, ErrorCode.UNAUTHORIZED, '인증이 필요합니다.');
    const submissions = await submissionService.getMySubmissions(req.user.userId);
    res.json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
};

export const getSubmissionById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, ErrorCode.UNAUTHORIZED, '인증이 필요합니다.');
    const isAdmin = req.user.role === 'ADMIN';
    const submission = await submissionService.getSubmissionById(
      req.params.id,
      req.user.userId,
      isAdmin,
    );
    res.json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
};

export const getAllSubmissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const submissions = await submissionService.getAllSubmissions();
    res.json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
};

// GET /submissions/admin/users/:userId — 특정 사용자 응시 현황 (ADMIN)
export const getSubmissionsByUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await submissionService.getSubmissionsByUser(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /submissions/admin/exams/:examId — 특정 시험 응시 현황 (ADMIN)
export const getSubmissionsByExam = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await submissionService.getSubmissionsByExam(req.params.examId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /submissions/:id/reset — 재응시 허용 (ADMIN)
export const resetSubmission = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await submissionService.resetSubmission(req.params.id);
    res.json({ success: true, data: { message: '재응시가 허용되었습니다.' } });
  } catch (err) {
    next(err);
  }
};
