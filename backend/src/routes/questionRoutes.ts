// questionRoutes.ts
// 역할: /questions 라우트 — 전부 ADMIN 전용

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import * as questionController from '../controllers/questionController';

export const questionRoutes: Router = Router();

// POST /questions — 문제 + 선택지 생성
questionRoutes.post('/', authenticate, requireAdmin, questionController.createQuestion);

// PATCH /questions/:id — 문제 수정
questionRoutes.patch('/:id', authenticate, requireAdmin, questionController.updateQuestion);

// DELETE /questions/:id — 문제 삭제
questionRoutes.delete('/:id', authenticate, requireAdmin, questionController.deleteQuestion);
