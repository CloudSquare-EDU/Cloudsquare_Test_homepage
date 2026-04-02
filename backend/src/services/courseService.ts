// courseService.ts
// 역할: 과정(Course) CRUD — 계정 및 시험 매핑 포함

import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

// ── 전체 과정 목록 ──────────────────────────────────────────
export const getAllCourses = async () => {
  return prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, exams: true } },
    },
  });
};

// ── 과정 상세 (소속 사용자 + 시험 포함) ───────────────────────
export const getCourseById = async (id: string) => {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      },
      exams: {
        select: { id: true, title: true, duration: true, isPublished: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!course) throw new AppError(404, ErrorCode.NOT_FOUND, '과정을 찾을 수 없습니다.');
  return course;
};

// ── 과정 생성 ────────────────────────────────────────────────
export const createCourse = async (name: string, description?: string) => {
  if (!name.trim()) {
    throw new AppError(400, ErrorCode.BAD_REQUEST, '과정 이름을 입력해주세요.');
  }
  return prisma.course.create({
    data: { name: name.trim(), description: description?.trim() || null },
  });
};

// ── 과정 수정 ────────────────────────────────────────────────
export const updateCourse = async (id: string, name: string, description?: string) => {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw new AppError(404, ErrorCode.NOT_FOUND, '과정을 찾을 수 없습니다.');
  return prisma.course.update({
    where: { id },
    data: { name: name.trim(), description: description?.trim() || null },
  });
};

// ── 과정 삭제 (소속 사용자/시험의 courseId는 null로 초기화) ──
export const deleteCourse = async (id: string) => {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw new AppError(404, ErrorCode.NOT_FOUND, '과정을 찾을 수 없습니다.');
  await prisma.course.delete({ where: { id } });
};

// ── 사용자 → 과정 매핑 ──────────────────────────────────────
export const assignUserToCourse = async (userId: string, courseId: string) => {
  const [user, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.course.findUnique({ where: { id: courseId } }),
  ]);
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.');
  if (!course) throw new AppError(404, ErrorCode.NOT_FOUND, '과정을 찾을 수 없습니다.');

  return prisma.user.update({ where: { id: userId }, data: { courseId } });
};

// ── 사용자 과정 해제 ─────────────────────────────────────────
export const removeUserFromCourse = async (userId: string) => {
  return prisma.user.update({ where: { id: userId }, data: { courseId: null } });
};

// ── 사용자 일괄 과정 매핑 ───────────────────────────────────
export const bulkAssignUsersToCourse = async (userIds: string[], courseId: string) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AppError(404, ErrorCode.NOT_FOUND, '과정을 찾을 수 없습니다.');

  const result = await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { courseId },
  });
  return { updated: result.count };
};

// ── 시험 → 과정 매핑 ────────────────────────────────────────
export const assignExamToCourse = async (examId: string, courseId: string) => {
  const [exam, course] = await Promise.all([
    prisma.exam.findUnique({ where: { id: examId } }),
    prisma.course.findUnique({ where: { id: courseId } }),
  ]);
  if (!exam) throw new AppError(404, ErrorCode.NOT_FOUND, '시험을 찾을 수 없습니다.');
  if (!course) throw new AppError(404, ErrorCode.NOT_FOUND, '과정을 찾을 수 없습니다.');

  return prisma.exam.update({ where: { id: examId }, data: { courseId } });
};

// ── 시험 과정 해제 ───────────────────────────────────────────
export const removeExamFromCourse = async (examId: string) => {
  return prisma.exam.update({ where: { id: examId }, data: { courseId: null } });
};
