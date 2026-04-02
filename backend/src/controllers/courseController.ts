// courseController.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as courseService from '../services/courseService';
import { AppError } from '../middlewares/errorHandler';
import { ErrorCode } from '../types';

const createSchema = z.object({
  name: z.string().min(1, '과정 이름을 입력해주세요.'),
  description: z.string().optional(),
});

const assignUsersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
});

// GET /courses
export const listCourses = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await courseService.getAllCourses();
    res.json({ success: true, data: courses });
  } catch (e) { next(e); }
};

// GET /courses/:id
export const getCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await courseService.getCourseById(req.params.id);
    res.json({ success: true, data: course });
  } catch (e) { next(e); }
};

// POST /courses
export const createCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const course = await courseService.createCourse(body.name, body.description);
    res.status(201).json({ success: true, data: course });
  } catch (e) { next(e); }
};

// PATCH /courses/:id
export const updateCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const course = await courseService.updateCourse(req.params.id, body.name, body.description);
    res.json({ success: true, data: course });
  } catch (e) { next(e); }
};

// DELETE /courses/:id
export const deleteCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await courseService.deleteCourse(req.params.id);
    res.json({ success: true, data: { message: '과정이 삭제되었습니다.' } });
  } catch (e) { next(e); }
};

// POST /courses/:id/users/:userId  — 사용자를 과정에 배정
export const assignUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await courseService.assignUserToCourse(req.params.userId, req.params.id);
    res.json({ success: true, data: { message: '사용자가 과정에 배정되었습니다.' } });
  } catch (e) { next(e); }
};

// DELETE /courses/:id/users/:userId  — 사용자 과정 해제
export const removeUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await courseService.removeUserFromCourse(req.params.userId);
    res.json({ success: true, data: { message: '사용자 과정 배정이 해제되었습니다.' } });
  } catch (e) { next(e); }
};

// POST /courses/:id/users/bulk  — 일괄 배정
export const bulkAssignUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIds } = assignUsersSchema.parse(req.body);
    const result = await courseService.bulkAssignUsersToCourse(userIds, req.params.id);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
};

// POST /courses/:id/exams/:examId  — 시험을 과정에 배정
export const assignExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await courseService.assignExamToCourse(req.params.examId, req.params.id);
    res.json({ success: true, data: { message: '시험이 과정에 배정되었습니다.' } });
  } catch (e) { next(e); }
};

// DELETE /courses/:id/exams/:examId  — 시험 과정 해제
export const removeExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await courseService.removeExamFromCourse(req.params.examId);
    res.json({ success: true, data: { message: '시험 과정 배정이 해제되었습니다.' } });
  } catch (e) { next(e); }
};
