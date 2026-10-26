// lib/api/submissions.ts
// 역할: 응시 관련 API 함수 모음

import { apiClient } from './client';
import {
  SubmissionResult,
  SubmissionSummary,
  SubmissionDetail,
  ExamSubmissionStatus,
  AssignedQuestion,
} from '../types';

export const submissionsApi = {
  // 시험 제출 — choiceIds 배열로 복수 정답 지원
  submit: (data: { examId: string; answers: Array<{ questionId: string; choiceIds: string[] }> }) =>
    apiClient.post<SubmissionResult>('/submissions', data),

  // 내 응시 목록
  getMy: () => apiClient.get<SubmissionSummary[]>('/submissions'),

  // 응시 결과 상세
  getById: (id: string) => apiClient.get<SubmissionDetail>(`/submissions/${id}`),

  // 특정 시험 응시 현황 (ADMIN)
  getByExam: (examId: string) =>
    apiClient.get<ExamSubmissionStatus>(`/submissions/admin/exams/${examId}`),

  // 재응시 허용 — submission 삭제 (ADMIN)
  reset: (submissionId: string) =>
    apiClient.delete<{ message: string }>(`/submissions/${submissionId}/reset`),

  // 사용자별 배정 문제 목록 (ADMIN)
  // attemptNo 를 생략하면 가장 최근 회차
  getUserAssignment: (examId: string, userId: string, attemptNo?: number) =>
    apiClient.get<AssignedQuestion[]>(
      `/submissions/admin/exams/${examId}/users/${userId}/assignment${attemptNo ? `?attemptNo=${attemptNo}` : ''}`,
    ),

  // 특정 시험의 내 제출 여부 확인 — 전용 엔드포인트로 단건 조회 (전체 목록 로드 불필요)
  checkExamById: (examId: string) =>
    apiClient.get<SubmissionSummary | null>(`/submissions/check/exam/${examId}`),
};
