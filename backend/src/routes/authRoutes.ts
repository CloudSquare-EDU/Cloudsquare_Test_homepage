// authRoutes.ts
// 역할: /auth 하위 라우트 정의

import { Router } from 'express';
import * as authController from '../controllers/authController';

export const authRoutes: Router = Router();

// POST /auth/register — 회원가입
authRoutes.post('/register', authController.register);

// POST /auth/login — 로그인
authRoutes.post('/login', authController.login);
