// userService.ts
// 역할: 관리자용 사용자 계정 관리 비즈니스 로직
// - 사용자 목록 조회
// - 관리자가 직접 사용자 계정 생성
// - role 변경 (USER ↔ ADMIN)

import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

// 전체 사용자 목록 조회 (비밀번호 제외)
export const getAllUsers = async () => {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { submissions: true, userExams: true } },
    },
  });
};

// 관리자가 사용자 계정 직접 생성
export const createUser = async (input: CreateUserInput) => {
  const { email, password, name, role = Role.USER } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, ErrorCode.CONFLICT, '이미 사용 중인 이메일입니다.');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  return prisma.user.create({
    data: { email, password: hashedPassword, name, role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
};

// 사용자 role 변경 (USER → ADMIN 또는 ADMIN → USER)
export const updateUserRole = async (userId: string, role: Role) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.');

  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
};

// 사용자 일괄 생성 (엑셀 업로드용)
// 실패한 항목은 건너뛰고 성공/실패 결과를 반환
export const bulkCreateUsers = async (
  users: CreateUserInput[],
): Promise<{ success: number; failed: { email: string; reason: string }[] }> => {
  const failed: { email: string; reason: string }[] = [];
  let success = 0;

  for (const input of users) {
    try {
      await createUser(input);
      success++;
    } catch (err) {
      failed.push({
        email: input.email,
        reason: err instanceof AppError ? err.message : '생성 실패',
      });
    }
  }

  return { success, failed };
};

// 사용자 삭제
export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.');

  await prisma.user.delete({ where: { id: userId } });
};
