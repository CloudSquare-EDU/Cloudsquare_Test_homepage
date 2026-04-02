// lib/api/courses.ts
import { apiClient } from './client';
import { CourseSummary, CourseDetail } from '../types';

export const coursesApi = {
  getAll: () => apiClient<CourseSummary[]>('GET', '/courses'),

  getById: (id: string) => apiClient<CourseDetail>('GET', `/courses/${id}`),

  create: (name: string, description?: string) =>
    apiClient<CourseSummary>('POST', '/courses', { name, description }),

  update: (id: string, name: string, description?: string) =>
    apiClient<CourseSummary>('PATCH', `/courses/${id}`, { name, description }),

  delete: (id: string) =>
    apiClient<{ message: string }>('DELETE', `/courses/${id}`),

  // 사용자 배정
  assignUser: (courseId: string, userId: string) =>
    apiClient<{ message: string }>('POST', `/courses/${courseId}/users/${userId}`),

  removeUser: (courseId: string, userId: string) =>
    apiClient<{ message: string }>('DELETE', `/courses/${courseId}/users/${userId}`),

  bulkAssignUsers: (courseId: string, userIds: string[]) =>
    apiClient<{ updated: number }>('POST', `/courses/${courseId}/users/bulk`, { userIds }),

  // 시험 배정
  assignExam: (courseId: string, examId: string) =>
    apiClient<{ message: string }>('POST', `/courses/${courseId}/exams/${examId}`),

  removeExam: (courseId: string, examId: string) =>
    apiClient<{ message: string }>('DELETE', `/courses/${courseId}/exams/${examId}`),
};
