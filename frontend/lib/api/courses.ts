// lib/api/courses.ts
import { apiClient } from './client';
import { CourseSummary, CourseDetail } from '../types';

export const coursesApi = {
  getAll: () => apiClient.get<CourseSummary[]>('/courses'),

  getById: (id: string) => apiClient.get<CourseDetail>(`/courses/${id}`),

  create: (name: string, description?: string) =>
    apiClient.post<CourseSummary>('/courses', { name, description }),

  update: (id: string, name: string, description?: string) =>
    apiClient.patch<CourseSummary>(`/courses/${id}`, { name, description }),

  delete: (id: string) =>
    apiClient.delete<{ message: string }>(`/courses/${id}`),

  // 사용자 배정
  assignUser: (courseId: string, userId: string) =>
    apiClient.post<{ message: string }>(`/courses/${courseId}/users/${userId}`, {}),

  removeUser: (courseId: string, userId: string) =>
    apiClient.delete<{ message: string }>(`/courses/${courseId}/users/${userId}`),

  bulkAssignUsers: (courseId: string, userIds: string[]) =>
    apiClient.post<{ updated: number }>(`/courses/${courseId}/users/bulk`, { userIds }),

  // 시험 배정
  assignExam: (courseId: string, examId: string) =>
    apiClient.post<{ message: string }>(`/courses/${courseId}/exams/${examId}`, {}),

  removeExam: (courseId: string, examId: string) =>
    apiClient.delete<{ message: string }>(`/courses/${courseId}/exams/${examId}`),
};
