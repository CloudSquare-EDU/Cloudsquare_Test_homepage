// lib/api/submissions.ts
// 역할: 응시 관련 API 함수 모음

import { apiClient } from './client';
import { SubmissionResult, SubmissionSummary, SubmissionDetail } from '../types';

export const submissionsApi = {
  submit: (data: { examId: string; answers: Array<{ questionId: string; choiceId: string }> }) =>
    apiClient.post<SubmissionResult>('/submissions', data),

  getMy: () => apiClient.get<SubmissionSummary[]>('/submissions'),

  getById: (id: string) => apiClient.get<SubmissionDetail>(`/submissions/${id}`),

  getAll: () => apiClient.get<SubmissionSummary[]>('/submissions/admin'),
};
