// lib/api/submissions.ts
// 역할: 응시 관련 API 함수 모음

import { apiClient } from './client';
import {
  SubmissionResult,
  SubmissionSummary,
  SubmissionDetail,
  AdminSubmissionSummary,
  UserSubmissionStatus,
  ExamSubmissionStatus,
} from '../types';

export const submissionsApi = {
  // 시험 제출 — choiceIds 배열로 복수 정답 지원
  submit: (data: { examId: string; answers: Array<{ questionId: string; choiceIds: string[] }> }) =>
    apiClient.post<SubmissionResult>('/submissions', data),

  // 내 응시 목록
  getMy: () => apiClient.get<SubmissionSummary[]>('/submissions'),

  // 응시 결과 상세
  getById: (id: string) => apiClient.get<SubmissionDetail>(`/submissions/${id}`),

  // 전체 응시 결과 (ADMIN)
  getAll: () => apiClient.get<AdminSubmissionSummary[]>('/submissions/admin'),

  // 특정 사용자 응시 현황 (ADMIN)
  getByUser: (userId: string) =>
    apiClient.get<UserSubmissionStatus>(`/submissions/admin/users/${userId}`),

  // 특정 시험 응시 현황 (ADMIN)
  getByExam: (examId: string) =>
    apiClient.get<ExamSubmissionStatus>(`/submissions/admin/exams/${examId}`),

  // 재응시 허용 — submission 삭제 (ADMIN)
  reset: (submissionId: string) =>
    apiClient.delete<{ message: string }>(`/submissions/${submissionId}/reset`),

  // 특정 시험의 내 제출 여부 확인 — 전용 엔드포인트로 단건 조회 (전체 목록 로드 불필요)
  checkExamById: (examId: string) =>
    apiClient.get<SubmissionSummary | null>(`/submissions/check/exam/${examId}`),
};
