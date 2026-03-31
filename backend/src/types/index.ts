// 공통 타입 정의
// 역할: 프로젝트 전반에서 사용하는 공유 타입 모음

import { Request } from 'express';
import { Role } from '@prisma/client';

// ─── JWT Payload ─────────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

// ─── Express Request 확장 (인증 미들웨어 후 user 정보 주입) ─────
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ─── 표준 API 응답 ───────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ─── 에러 코드 상수 ──────────────────────────────────────────
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
