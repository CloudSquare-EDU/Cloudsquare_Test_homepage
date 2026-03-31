// authMiddleware
// 역할: JWT 검증 후 req.user에 페이로드 주입. 관리자 전용 라우트 보호도 담당.

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JwtPayload, ErrorCode } from '../types';
import { AppError } from './errorHandler';
import { Role } from '@prisma/client';

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
  return secret;
};

// 로그인 사용자 인증 미들웨어
export const authenticate = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, '인증 토큰이 필요합니다.');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, getSecret()) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, '유효하지 않거나 만료된 토큰입니다.');
  }
};

// 관리자 권한 검증 미들웨어 (authenticate 이후 사용)
export const requireAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.user || req.user.role !== Role.ADMIN) {
    throw new AppError(403, ErrorCode.FORBIDDEN, '관리자 권한이 필요합니다.');
  }
  next();
};
