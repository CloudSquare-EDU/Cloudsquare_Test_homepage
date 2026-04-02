// submissionRoutes.ts
// 역할: /submissions 라우트 정의

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import * as submissionController from '../controllers/submissionController';

export const submissionRoutes: Router = Router();

// POST /submissions — 시험 제출 + 즉시 채점
submissionRoutes.post('/', authenticate, submissionController.submitExam);

// GET /submissions/check/exam/:examId — 특정 시험의 내 응시 여부 단건 확인
// 반드시 /:id 보다 먼저 선언해야 "check"가 :id로 매칭되지 않음
submissionRoutes.get(
  '/check/exam/:examId',
  authenticate,
  submissionController.checkMySubmissionForExam,
);

// GET /submissions — 내 응시 목록
submissionRoutes.get('/', authenticate, submissionController.getMySubmissions);

// GET /submissions/admin — 전체 응시 결과 (ADMIN)
submissionRoutes.get('/admin', authenticate, requireAdmin, submissionController.getAllSubmissions);

// GET /submissions/admin/exams/:examId — 특정 시험 응시 현황 (ADMIN)
submissionRoutes.get(
  '/admin/exams/:examId',
  authenticate,
  requireAdmin,
  submissionController.getSubmissionsByExam,
);

// GET /submissions/admin/users/:userId — 특정 사용자 응시 현황 (ADMIN)
submissionRoutes.get(
  '/admin/users/:userId',
  authenticate,
  requireAdmin,
  submissionController.getSubmissionsByUser,
);

// DELETE /submissions/:id/reset — 재응시 허용 (ADMIN)
submissionRoutes.delete(
  '/:id/reset',
  authenticate,
  requireAdmin,
  submissionController.resetSubmission,
);

// GET /submissions/:id — 응시 결과 상세
submissionRoutes.get('/:id', authenticate, submissionController.getSubmissionById);
