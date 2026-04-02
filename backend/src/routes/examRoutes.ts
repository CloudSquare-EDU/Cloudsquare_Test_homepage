// examRoutes.ts
// 역할: /exams 라우트 정의 — 인증 및 관리자 권한 미들웨어 적용

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import * as examController from '../controllers/examController';

export const examRoutes: Router = Router();

// GET /exams/my — USER: 시험 목록 + 응시 상태 통합 (홈 화면 단일 호출)
// 반드시 /:id 보다 먼저 선언해야 "my"가 :id로 매칭되지 않음
examRoutes.get('/my', authenticate, examController.getMyExams);

// GET /exams — USER: 공개 목록, ADMIN: 전체 목록
examRoutes.get('/', authenticate, examController.getExams);

// GET /exams/:id — 시험 상세 + 문제 조회 (정답 제외)
examRoutes.get('/:id', authenticate, examController.getExamById);

// POST /exams — 시험 생성 (ADMIN 전용)
examRoutes.post('/', authenticate, requireAdmin, examController.createExam);

// PATCH /exams/:id — 시험 수정 (ADMIN 전용)
examRoutes.patch('/:id', authenticate, requireAdmin, examController.updateExam);

// DELETE /exams/:id — 시험 삭제 (ADMIN 전용)
examRoutes.delete('/:id', authenticate, requireAdmin, examController.deleteExam);

// PATCH /exams/:id/publish — 시험 공개 (ADMIN 전용)
examRoutes.patch('/:id/publish', authenticate, requireAdmin, examController.publishExam);

// GET /exams/:id/users — 시험에 할당된 사용자 목록 (ADMIN 전용)
examRoutes.get('/:id/users', authenticate, requireAdmin, examController.getAssignedUsers);

// POST /exams/:id/users — 사용자 할당 (ADMIN 전용)
examRoutes.post('/:id/users', authenticate, requireAdmin, examController.assignUser);

// DELETE /exams/:id/users/:userId — 할당 해제 (ADMIN 전용)
examRoutes.delete('/:id/users/:userId', authenticate, requireAdmin, examController.removeUser);
