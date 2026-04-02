// lib/api/questionBanks.ts
import { apiClient } from './client';
import { QuestionBankSummary, QuestionBankDetail, BankQuestionSummary } from '../types';

export interface BankQuestionInput {
  content: string;
  choices: { content: string; isCorrect: boolean; order: number }[];
}

export interface BulkImportResult {
  success: number;
  failed: { row: number; reason: string }[];
}

export const questionBanksApi = {
  getAll: () => apiClient.get<QuestionBankSummary[]>('/question-banks'),

  getById: (id: string) => apiClient.get<QuestionBankDetail>(`/question-banks/${id}`),

  create: (name: string, description?: string) =>
    apiClient.post<QuestionBankSummary>('/question-banks', { name, description }),

  update: (id: string, name: string, description?: string) =>
    apiClient.patch<QuestionBankSummary>(`/question-banks/${id}`, { name, description }),

  delete: (id: string) =>
    apiClient.delete<{ message: string }>(`/question-banks/${id}`),

  // 문제 CRUD
  addQuestion: (bankId: string, input: BankQuestionInput) =>
    apiClient.post<BankQuestionSummary>(`/question-banks/${bankId}/questions`, input),

  updateQuestion: (bankId: string, questionId: string, input: BankQuestionInput) =>
    apiClient.patch<BankQuestionSummary>(`/question-banks/${bankId}/questions/${questionId}`, input),

  deleteQuestion: (bankId: string, questionId: string) =>
    apiClient.delete<{ message: string }>(`/question-banks/${bankId}/questions/${questionId}`),

  // 엑셀 일괄 등록
  // 프론트에서 SheetJS로 파싱 후 호출
  bulkImport: (bankId: string, questions: BankQuestionInput[], replace = false) =>
    apiClient.post<BulkImportResult>(`/question-banks/${bankId}/bulk`, { questions, replace }),
};
