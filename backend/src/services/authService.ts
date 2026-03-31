// authService.ts
// 역할: 회원가입, 로그인 비즈니스 로직
// 설계 이유: Controller는 요청/응답만, 실제 로직은 Service에서 처리 (관심사 분리)

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode, JwtPayload } from '../types';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

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
  };
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET이 설정되지 않았습니다.');
  return secret;
};

export const register = async (input: RegisterInput): Promise<AuthResult> => {
  const { email, password, name } = input;

  // 이메일 중복 확인
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, ErrorCode.CONFLICT, '이미 사용 중인 이메일입니다.');
  }

  // 비밀번호 해시 (salt rounds: 12)
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
    select: { id: true, email: true, name: true, role: true },
  });

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });

  return { accessToken, user };
};

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const { email, password } = input;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // 보안상 이메일/비밀번호 구분 없이 동일 메시지
    throw new AppError(401, ErrorCode.UNAUTHORIZED, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });

  return {
    accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
};
