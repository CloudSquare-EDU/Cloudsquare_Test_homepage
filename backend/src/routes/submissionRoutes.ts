// submissionRoutes.ts
// 역할: /submissions 라우트 정의

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import * as submissionController from '../controllers/submissionController';

export const submissionRoutes: Router = Router();

// POST /submissions — 시험 제출 + 즉시 채점
submissionRoutes.post('/', authenticate, submissionController.submitExam);

// GET /submissions — 내 응시 목록
submissionRoutes.get('/', authenticate, submissionController.getMySubmissions);

// GET /submissions/admin — 전체 응시 결과 (ADMIN)
submissionRoutes.get('/admin', authenticate, requireAdmin, submissionController.getAllSubmissions);

// GET /submissions/:id — 응시 결과 상세
submissionRoutes.get('/:id', authenticate, submissionController.getSubmissionById);
