// userRoutes.ts
// 역할: /users 라우트 — 전부 ADMIN 전용

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import * as userController from '../controllers/userController';

export const userRoutes: Router = Router();

// GET /users — 전체 사용자 목록
userRoutes.get('/', authenticate, requireAdmin, userController.getAllUsers);

// POST /users — 사용자 계정 직접 생성
userRoutes.post('/', authenticate, requireAdmin, userController.createUser);

// PATCH /users/:id/role — role 변경 (USER ↔ ADMIN)
userRoutes.patch('/:id/role', authenticate, requireAdmin, userController.updateUserRole);

// DELETE /users/:id — 사용자 삭제
userRoutes.delete('/:id', authenticate, requireAdmin, userController.deleteUser);
