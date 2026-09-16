// lib/api/courses.ts
import { apiClient } from './client';
import { CourseSummary, CourseDetail } from '../types';

export interface PaginatedCoursesResponse {
  data: CourseSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const coursesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; archived?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.archived !== undefined) qs.set('archived', String(params.archived));
    const query = qs.toString();
    return apiClient.get<PaginatedCoursesResponse>(`/courses${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<CourseDetail>(`/courses/${id}`),

  create: (name: string, description?: string) =>
    apiClient.post<CourseSummary>('/courses', { name, description }),

  update: (id: string, name: string, description?: string) =>
    apiClient.patch<CourseSummary>(`/courses/${id}`, { name, description }),

  delete: (id: string) =>
    apiClient.delete<{ message: string }>(`/courses/${id}`),

  // 보관 / 보관 해제
  archive: (id: string) =>
    apiClient.patch<CourseSummary>(`/courses/${id}/archive`, {}),

  unarchive: (id: string) =>
    apiClient.patch<CourseSummary>(`/courses/${id}/unarchive`, {}),

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
