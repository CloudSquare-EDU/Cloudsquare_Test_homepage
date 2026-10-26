// lib/api/exams.ts
// 역할: 시험 관련 API 함수 모음

import { apiClient } from './client';
import { ExamDetail, AdminExam, ExamWithSubmission } from '../types';

export const examsApi = {
  // 홈 화면용 — 시험 목록 + 응시 상태를 한 번에 조회 (API 콜 2→1)
  getMy: () => apiClient.get<ExamWithSubmission[]>('/exams/my'),

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
    examType?: 'SELF_STUDY' | 'REAL_EXAM';
    questionBankId?: string;
    questionCount?: number;
    startDate?: string | null;
    deadline?: string | null;
  }) => apiClient.post<ExamDetail>('/exams', data),

  update: (id: string, data: {
    title?: string;
    description?: string;
    duration?: number;
    examType?: 'SELF_STUDY' | 'REAL_EXAM';
    questionBankId?: string;
    questionCount?: number;
    startDate?: string | null;
    deadline?: string | null;
  }) => apiClient.patch<ExamDetail>(`/exams/${id}`, data),

  delete: (id: string) => apiClient.delete<{ message: string }>(`/exams/${id}`),

  // 재응시 시작 — 새 회차 문제를 랜덤 추첨해서 시험 정보를 받아온다
  startRetake: (id: string) => apiClient.post<ExamDetail>(`/exams/${id}/retake`, {}),
};
