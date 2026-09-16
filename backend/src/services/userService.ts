// userService.ts
// 역할: 관리자용 사용자 계정 관리 비즈니스 로직
// - 사용자 목록 조회
// - 관리자가 직접 사용자 계정 생성
// - role 변경 (USER ↔ ADMIN)

import bcrypt from 'bcryptjs';
import { Role, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

// 전체 사용자 목록 조회 (페이지네이션 + 검색 지원)
export const getAllUsers = async (params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}) => {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = params.search
    ? {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        courseId: true,
        mustChangePassword: true,
        createdAt: true,
        course: { select: { id: true, name: true } },
        _count: { select: { submissions: true, userExams: true } },
      },
    }),
  ]);

  return {
    data: users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
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
    data: { email, password: hashedPassword, name, role, mustChangePassword: true },
    select: { id: true, email: true, name: true, role: true, mustChangePassword: true, createdAt: true },
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
//
// courseName이 함께 오면 계정 생성 직후 서버에서 바로 과정을 매핑한다.
// (예전에는 프론트에서 사용자/과정 "전체 목록"을 조회한 뒤 이메일·과정명으로
//  매칭했는데, 목록 조회 API가 최대 100건까지만 내려주는 상한이 있어서
//  사용자가 100명을 넘으면 뒤쪽 사용자가 매칭에서 조용히 누락되는 문제가 있었다.
//  서버에서 생성과 동시에 매핑하면 이 문제가 아예 발생하지 않는다.)
export const bulkCreateUsers = async (
  users: (CreateUserInput & { courseName?: string })[],
): Promise<{
  success: number;
  failed: { email: string; reason: string }[];
  courseAssigned: number;
  courseFailed: { email: string; reason: string }[];
}> => {
  const failed: { email: string; reason: string }[] = [];
  const courseFailed: { email: string; reason: string }[] = [];
  let success = 0;
  let courseAssigned = 0;

  // 같은 과정명을 매번 다시 조회하지 않도록 캐시
  const courseIdCache = new Map<string, string | null>();
  const resolveCourseId = async (courseName: string): Promise<string | null> => {
    if (courseIdCache.has(courseName)) return courseIdCache.get(courseName) ?? null;
    const course = await prisma.course.findFirst({ where: { name: courseName } });
    const courseId = course?.id ?? null;
    courseIdCache.set(courseName, courseId);
    return courseId;
  };

  for (const { courseName, ...input } of users) {
    try {
      const user = await createUser(input);
      success++;

      const trimmedCourseName = courseName?.trim();
      if (trimmedCourseName) {
        const courseId = await resolveCourseId(trimmedCourseName);
        if (courseId) {
          await prisma.user.update({ where: { id: user.id }, data: { courseId } });
          courseAssigned++;
        } else {
          courseFailed.push({
            email: input.email,
            reason: `'${trimmedCourseName}' 과정을 찾을 수 없습니다.`,
          });
        }
      }
    } catch (err) {
      failed.push({
        email: input.email,
        reason: err instanceof AppError ? err.message : '생성 실패',
      });
    }
  }

  return { success, failed, courseAssigned, courseFailed };
};

// 관리자가 특정 사용자 비밀번호 초기화
export const resetUserPassword = async (userId: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.');

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  // 관리자가 초기화하면 다시 mustChangePassword = true
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword, mustChangePassword: true } });
};

// 본인이 직접 비밀번호 변경 (현재 비밀번호 확인 필요)
export const changeMyPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.');

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new AppError(400, ErrorCode.BAD_REQUEST, '현재 비밀번호가 올바르지 않습니다.');

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  // 비밀번호 직접 변경 시 mustChangePassword 해제
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword, mustChangePassword: false } });
};

// 사용자 삭제
export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.');
  await prisma.user.delete({ where: { id: userId } });
};
