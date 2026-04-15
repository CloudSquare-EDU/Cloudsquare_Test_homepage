// lib/api/exams.ts
// 역할: 시험 관련 API 함수 모음

import { apiClient } from './client';
import { ExamSummary, ExamDetail, AdminExam, ExamWithSubmission } from '../types';

export const examsApi = {
  // 홈 화면용 — 시험 목록 + 응시 상태를 한 번에 조회 (API 콜 2→1)
  getMy: () => apiClient.get<ExamWithSubmission[]>('/exams/my'),

  getAll: () => apiClient.get<ExamSummary[]>('/exams'),

  getAllAdmin: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return apiClient.get<{ data: AdminExam[]; total: number; page: number; limit: number; totalPages: number }>(`/exams${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<ExamDetail>(`/exams/${id}`),

  create: (data: {
    title: string;
    description?: string;
    duration: number;
    questionBankId?: string;
    questionCount?: number;
    startDate?: string | null;
    deadline?: string | null;
  }) => apiClient.post<ExamDetail>('/exams', data),

  update: (id: string, data: {
    title?: string;
    description?: string;
    duration?: number;
    questionBankId?: string;
    questionCount?: number;
    startDate?: string | null;
    deadline?: string | null;
  }) => apiClient.patch<ExamDetail>(`/exams/${id}`, data),

  delete: (id: string) => apiClient.delete<{ message: string }>(`/exams/${id}`),


  publish: (id: string) => apiClient.patch<ExamDetail>(`/exams/${id}/publish`, {}),

  unpublish: (id: string) => apiClient.patch<ExamDetail>(`/exams/${id}/unpublish`, {}),

  assignUsers: (examId: string, userIds: string[]) =>
    apiClient.post(`/exams/${examId}/users/bulk`, { userIds }),
};
