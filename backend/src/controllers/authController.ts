// authController.ts
// 역할: /auth 요청 수신 → zod 검증 → Service 호출 → 응답 반환

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';

const loginSchema = z.object({
  email: z.string().email('유효한 이메일 형식이 아닙니다.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

// 회원가입 엔드포인트는 제공하지 않는다 — 계정은 관리자가 /users(/bulk)로만 생성.

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
