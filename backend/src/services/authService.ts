// authService.ts
// 역할: 회원가입, 로그인 비즈니스 로직
// 설계 이유: Controller는 요청/응답만, 실제 로직은 Service에서 처리 (관심사 분리)

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode, JwtPayload } from '../types';

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    mustChangePassword: boolean;
  };
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET이 설정되지 않았습니다.');
  return secret;
};

// 공개 회원가입은 제공하지 않는다 (계정은 관리자가 userService.createUser/bulkCreateUsers로만 생성).

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { course: { select: { isArchived: true } } },
  });
  if (!user) {
    // 보안상 이메일/비밀번호 구분 없이 동일 메시지
    throw new AppError(401, ErrorCode.UNAUTHORIZED, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  // 소속 과정이 보관 처리된 경우 로그인 차단 (관리자 계정은 과정에 속하지 않으므로 영향 없음)
  if (user.course?.isArchived) {
    throw new AppError(403, ErrorCode.FORBIDDEN, '소속 과정이 보관 처리되어 로그인할 수 없습니다. 관리자에게 문의해주세요.');
  }

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });

  return {
    accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword },
  };
};
