// questionBankController.ts
// 역할: 문제은행 HTTP 요청 처리

import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types';
import * as svc from '../services/questionBankService';

// ── Zod 스키마 ─────────────────────────────────────────────────

const createBankSchema = z.object({
  name: z.string().min(1, '문제은행 이름을 입력하세요.'),
  description: z.string().optional(),
});

const questionSchema = z.object({
  content: z.string().min(1, '문제 내용을 입력하세요.'),
  choices: z.array(
    z.object({
      content: z.string().min(1, '선택지 내용을 입력하세요.'),
      isCorrect: z.boolean(),
      order: z.number().int().min(1),
    }),
  ).min(2, '선택지를 2개 이상 입력하세요.'),
});

const bulkImportSchema = z.object({
  questions: z.array(questionSchema).min(1),
  replace: z.boolean().optional().default(false),
});

// ── 핸들러 ────────────────────────────────────────────────────

export const listBanks = async (_req: AuthRequest, res: Response) => {
  const banks = await svc.getAllBanks();
  res.json(banks);
};

export const getBank = async (req: AuthRequest, res: Response) => {
  const bank = await svc.getBankById(req.params.id);
  res.json(bank);
};

export const createBank = async (req: AuthRequest, res: Response) => {
  const { name, description } = createBankSchema.parse(req.body);
  const bank = await svc.createBank(name, description);
  res.status(201).json(bank);
};

export const updateBank = async (req: AuthRequest, res: Response) => {
  const { name, description } = createBankSchema.parse(req.body);
  const bank = await svc.updateBank(req.params.id, name, description);
  res.json(bank);
};

export const deleteBank = async (req: AuthRequest, res: Response) => {
  await svc.deleteBank(req.params.id);
  res.json({ message: '문제은행이 삭제되었습니다.' });
};

export const addQuestion = async (req: AuthRequest, res: Response) => {
  const input = questionSchema.parse(req.body);
  const question = await svc.addQuestion(req.params.id, input);
  res.status(201).json(question);
};

export const updateQuestion = async (req: AuthRequest, res: Response) => {
  const input = questionSchema.parse(req.body);
  const question = await svc.updateQuestion(req.params.questionId, input);
  res.json(question);
};

export const deleteQuestion = async (req: AuthRequest, res: Response) => {
  await svc.deleteQuestion(req.params.questionId);
  res.json({ message: '문제가 삭제되었습니다.' });
};

// 엑셀 일괄 등록 — 파싱된 JSON 배열을 그대로 받음
// 프론트에서 SheetJS로 파싱 후 POST /question-banks/:id/bulk
export const bulkImport = async (req: AuthRequest, res: Response) => {
  const { questions, replace } = bulkImportSchema.parse(req.body);
  const result = await svc.bulkAddQuestions(req.params.id, questions, replace);
  res.json(result);
};
