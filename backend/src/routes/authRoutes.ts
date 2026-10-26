// authRoutes.ts
// 역할: /auth 하위 라우트 정의

import { Router } from 'express';
import * as authController from '../controllers/authController';
import { createRateLimiter } from '../middlewares/rateLimit';

export const authRoutes: Router = Router();

// 회원가입(POST /auth/register)은 의도적으로 제공하지 않는다.
// 계정은 관리자가 /users, /users/bulk 로만 생성한다 (프론트 회원가입 페이지도 안내만 표시).

// POST /auth/login — 로그인
authRoutes.post('/login', authController.login);

// POST /auth/find-account — ID 찾기 (이름 + 학번). 로그인 없이 호출되므로 IP당 횟수를 제한한다.
authRoutes.post(
  '/find-account',
  createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: '조회 횟수를 초과했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.',
  }),
  authController.findAccount,
);
