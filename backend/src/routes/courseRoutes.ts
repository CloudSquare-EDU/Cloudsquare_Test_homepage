// courseRoutes.ts
import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireAdmin } from '../middlewares/requireAdmin';
import * as ctrl from '../controllers/courseController';

export const courseRoutes = Router();

// 모든 과정 라우트는 관리자 전용
courseRoutes.use(authenticate, requireAdmin);

courseRoutes.get('/',                           ctrl.listCourses);
courseRoutes.get('/:id',                        ctrl.getCourse);
courseRoutes.post('/',                          ctrl.createCourse);
courseRoutes.patch('/:id',                      ctrl.updateCourse);
courseRoutes.delete('/:id',                     ctrl.deleteCourse);

// 사용자 배정
courseRoutes.post('/:id/users/bulk',            ctrl.bulkAssignUsers);
courseRoutes.post('/:id/users/:userId',         ctrl.assignUser);
courseRoutes.delete('/:id/users/:userId',       ctrl.removeUser);

// 시험 배정
courseRoutes.post('/:id/exams/:examId',         ctrl.assignExam);
courseRoutes.delete('/:id/exams/:examId',       ctrl.removeExam);
