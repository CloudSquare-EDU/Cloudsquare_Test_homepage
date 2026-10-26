// authController.ts
// 역할: /auth 요청 수신 → zod 검증 → Service 호출 → 응답 반환

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import * as userService from '../services/userService';

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

const findAccountSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요.').max(50),
  studentNumber: z.string().trim().min(1, '학번을 입력해주세요.').max(50),
});

// POST /auth/find-account — 로그인 전 공개. 이름 + 학번으로 모의시험 사이트 ID / NCP 실습 계정 ID 조회
export const findAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, studentNumber } = findAccountSchema.parse(req.body);
    const accounts = await userService.findAccountsByNameAndStudentNumber(name, studentNumber);
    res.status(200).json({ success: true, data: { accounts } });
  } catch (err) {
    next(err);
  }
};
