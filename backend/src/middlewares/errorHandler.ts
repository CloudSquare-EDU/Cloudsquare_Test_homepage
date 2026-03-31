// errorHandler 미들웨어
// 역할: 모든 라우트에서 던진 에러를 통합 처리하여 표준 응답 형식으로 반환

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse, ErrorCode } from '../types';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Zod 유효성 검증 에러
  if (err instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.BAD_REQUEST,
        message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      },
    };
    res.status(400).json(response);
    return;
  }

  // 커스텀 AppError
  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // 알 수 없는 에러 (500)
  console.error('[Unhandled Error]', err);
  const response: ApiResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: '서버 내부 오류가 발생했습니다.',
    },
  };
  res.status(500).json(response);
};
