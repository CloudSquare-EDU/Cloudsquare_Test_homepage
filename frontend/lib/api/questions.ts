// lib/api/questions.ts
// 역할: 문제 관련 API 함수 모음 (관리자 전용)

import { apiClient } from './client';

interface ChoiceInput {
  content: string;
  isCorrect: boolean;
  order: number;
}

export const questionsApi = {
  create: (data: { examId: string; content: string; order: number; choices: ChoiceInput[] }) =>
    apiClient.post('/questions', data),

  update: (
    id: string,
    data: { content?: string; order?: number; choices?: ChoiceInput[] },
  ) => apiClient.patch(`/questions/${id}`, data),

  delete: (id: string) => apiClient.delete(`/questions/${id}`),
};
