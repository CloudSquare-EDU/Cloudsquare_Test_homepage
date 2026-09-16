// authRoutes.ts
// 역할: /auth 하위 라우트 정의

import { Router } from 'express';
import * as authController from '../controllers/authController';

export const authRoutes: Router = Router();

// 회원가입(POST /auth/register)은 의도적으로 제공하지 않는다.
// 계정은 관리자가 /users, /users/bulk 로만 생성한다 (프론트 회원가입 페이지도 안내만 표시).

// POST /auth/login — 로그인
authRoutes.post('/login', authController.login);
