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

  // 보관된 과정에 속한 사용자는 관리자 목록에서 기본적으로 숨긴다.
  // (과정 자체는 삭제되지 않으므로 사용자 데이터도 그대로 남아있지만, 화면에는 노출하지 않음)
  const archivedFilter = { OR: [{ courseId: null }, { course: { isArchived: false } }] };
  const searchFilter = params.search
    ? {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }
    : null;
  const where = searchFilter ? { AND: [archivedFilter, searchFilter] } : archivedFilter;

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

// 엑셀 일괄 등록 전에 "이미 존재하는 이메일"을 미리 조회한다.
// - 보관된 과정에 속해 있어 목록에서는 보이지 않는 계정도 포함해서 찾는다.
//   (과거 수강생을 새 과정에 다시 매핑하는 것이 주된 사용 목적이기 때문)
export const findExistingUsersByEmails = async (emails: string[]) => {
  const uniqueEmails = Array.from(new Set(emails));
  const found = await prisma.user.findMany({
    where: { email: { in: uniqueEmails } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      course: { select: { id: true, name: true, isArchived: true } },
    },
  });
  return found.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    courseName: u.course?.name ?? null,
    courseArchived: u.course?.isArchived ?? false,
  }));
};

interface BulkOptions {
  // true면 이미 존재하는 이메일을 실패 처리하지 않고 덮어쓴다(이름 갱신 + 과정 매핑).
  overwriteExisting?: boolean;
  // true면 덮어쓸 때 비밀번호도 엑셀 값으로 교체한다(이 경우 다음 로그인 때 변경을 요구).
  // false면 기존 비밀번호는 그대로 유지 — 학생이 이미 바꾼 비밀번호를 실수로 되돌리지 않기 위함.
  overwritePassword?: boolean;
}

// 사용자 일괄 생성 (엑셀 업로드용)
// 실패한 항목은 건너뛰고 성공/실패 결과를 반환
//
// courseName이 함께 오면 계정 생성 직후 서버에서 바로 과정을 매핑한다.
// (예전에는 프론트에서 사용자/과정 "전체 목록"을 조회한 뒤 이메일·과정명으로
//  매칭했는데, 목록 조회 API가 최대 100건까지만 내려주는 상한이 있어서
//  사용자가 100명을 넘으면 뒤쪽 사용자가 매칭에서 조용히 누락되는 문제가 있었다.
//  서버에서 생성과 동시에 매핑하면 이 문제가 아예 발생하지 않는다.)
//
// overwriteExisting 옵션이 켜져 있으면, 이미 존재하는 이메일은 "기존 계정 갱신"으로 처리한다.
//  - 이름: 엑셀 값으로 갱신
//  - 과정: 엑셀에 과정명이 있을 때만 변경 (비어 있으면 기존 과정 유지 — 실수로 과정이 풀리지 않도록)
//  - 비밀번호: overwritePassword가 true일 때만 교체
//  - 권한(role): 변경하지 않음 (권한 변경은 별도 기능으로만)
//  - 관리자(ADMIN) 계정: 안전을 위해 건드리지 않고 실패 목록에 사유를 남김
export const bulkCreateUsers = async (
  users: (CreateUserInput & { courseName?: string })[],
  options: BulkOptions = {},
): Promise<{
  success: number;
  updated: number;
  failed: { email: string; reason: string }[];
  courseAssigned: number;
  courseFailed: { email: string; reason: string }[];
}> => {
  const { overwriteExisting = false, overwritePassword = false } = options;
  const failed: { email: string; reason: string }[] = [];
  const courseFailed: { email: string; reason: string }[] = [];
  let success = 0;
  let updated = 0;
  let courseAssigned = 0;

  // 같은 과정명을 매번 다시 조회하지 않도록 캐시
  const courseIdCache = new Map<string, string | null>();
  const resolveCourseId = async (courseName: string): Promise<string | null> => {
    if (courseIdCache.has(courseName)) return courseIdCache.get(courseName) ?? null;
    const course = await prisma.course.findFirst({ where: { name: courseName, isArchived: false } });
    const courseId = course?.id ?? null;
    courseIdCache.set(courseName, courseId);
    return courseId;
  };

  for (const { courseName, ...input } of users) {
    try {
      const trimmedCourseName = courseName?.trim();

      // 1) 기존 계정이 있고 덮어쓰기 모드면 → 갱신
      const existing = overwriteExisting
        ? await prisma.user.findUnique({ where: { email: input.email } })
        : null;

      let userId: string;
      if (existing) {
        if (existing.role === Role.ADMIN) {
          throw new AppError(
            400,
            ErrorCode.BAD_REQUEST,
            '관리자 계정은 일괄 덮어쓰기 대상이 아닙니다.',
          );
        }
        const data: Prisma.UserUpdateInput = { name: input.name };
        if (overwritePassword) {
          data.password = await bcrypt.hash(input.password, 12);
          data.mustChangePassword = true;
        }
        await prisma.user.update({ where: { id: existing.id }, data });
        userId = existing.id;
        updated++;
      } else {
        // 2) 없으면 신규 생성 (덮어쓰기 모드가 아니면 기존 이메일은 여기서 409로 실패 처리됨)
        const user = await createUser(input);
        userId = user.id;
        success++;
      }

      // 3) 과정 매핑 (신규/기존 공통)
      if (trimmedCourseName) {
        const courseId = await resolveCourseId(trimmedCourseName);
        if (courseId) {
          await prisma.user.update({ where: { id: userId }, data: { courseId } });
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

  return { success, updated, failed, courseAssigned, courseFailed };
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
