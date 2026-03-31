// lib/api/exams.ts
// 역할: 시험 관련 API 함수 모음

import { apiClient } from './client';
import { ExamSummary, ExamDetail, AdminExam } from '../types';

export const examsApi = {
  getAll: () => apiClient.get<ExamSummary[]>('/exams'),

  getAllAdmin: () => apiClient.get<AdminExam[]>('/exams'),

  getById: (id: string) => apiClient.get<ExamDetail>(`/exams/${id}`),

  create: (data: { title: string; description?: string; duration: number }) =>
    apiClient.post<ExamDetail>('/exams', data),

  update: (id: string, data: { title?: string; description?: string; duration?: number }) =>
    apiClient.patch<ExamDetail>(`/exams/${id}`, data),

  delete: (id: string) => apiClient.delete<{ message: string }>(`/exams/${id}`),

  publish: (id: string) => apiClient.patch<ExamDetail>(`/exams/${id}/publish`, {}),
};
