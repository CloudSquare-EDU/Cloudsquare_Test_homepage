// questionController.ts
// 역할: /questions 요청 처리 — zod 검증 후 questionService 호출

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types';
import * as questionService from '../services/questionService';

const choiceSchema = z.object({
  content: z.string().min(1, '선택지 내용을 입력해주세요.'),
  isCorrect: z.boolean(),
  order: z.number().int().positive(),
});

const createQuestionSchema = z.object({
  examId: z.string().min(1, 'examId가 필요합니다.'),
  content: z.string().min(1, '문제 내용을 입력해주세요.'),
  order: z.number().int().positive('순서는 양수여야 합니다.'),
  choices: z
    .array(choiceSchema)
    .min(2, '선택지는 최소 2개 이상이어야 합니다.')
    .max(5, '선택지는 최대 5개까지 가능합니다.'),
});

const updateQuestionSchema = z.object({
  content: z.string().min(1).optional(),
  order: z.number().int().positive().optional(),
  choices: z.array(choiceSchema).min(2).max(5).optional(),
});

export const createQuestion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createQuestionSchema.parse(req.body);
    const question = await questionService.createQuestion(input);
    res.status(201).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

export const updateQuestion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateQuestionSchema.parse(req.body);
    const question = await questionService.updateQuestion(req.params.id, input);
    res.json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

const bulkCreateSchema = z.object({
  examId: z.string().min(1, 'examId가 필요합니다.'),
  questions: z
    .array(
      z.object({
        content: z.string().min(1, '문제 내용을 입력해주세요.'),
        order: z.number().int().positive(),
        choices: z
          .array(choiceSchema)
          .min(2, '선택지는 최소 2개 이상이어야 합니다.')
          .max(5, '선택지는 최대 5개까지 가능합니다.'),
      }),
    )
    .min(1, '최소 1개 이상의 문제가 필요합니다.'),
});

export const bulkCreateQuestions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { examId, questions } = bulkCreateSchema.parse(req.body);
    const result = await questionService.bulkCreateQuestions(examId, questions);
    res.status(201).json({ success: true, data: result, count: result.length });
  } catch (err) {
    next(err);
  }
};

export const deleteQuestion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await questionService.deleteQuestion(req.params.id);
    res.json({ success: true, data: { message: '문제가 삭제되었습니다.' } });
  } catch (err) {
    next(err);
  }
};
