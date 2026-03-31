// userExamController.ts
// 역할: 시험-사용자 매핑 요청 처리

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types';
import * as userExamService from '../services/userExamService';

const assignSchema = z.object({
  userId: z.string().min(1, 'userId가 필요합니다.'),
});

// POST /exams/:id/users — 시험에 사용자 할당
export const assignUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId } = assignSchema.parse(req.body);
    const result = await userExamService.assignUserToExam(req.params.id, userId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// DELETE /exams/:id/users/:userId — 시험에서 사용자 할당 해제
export const removeUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await userExamService.removeUserFromExam(req.params.id, req.params.userId);
    res.json({ success: true, data: { message: '할당이 해제되었습니다.' } });
  } catch (err) {
    next(err);
  }
};

// GET /exams/:id/users — 시험에 할당된 사용자 목록
export const getAssignedUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const users = await userExamService.getUsersByExam(req.params.id);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};
