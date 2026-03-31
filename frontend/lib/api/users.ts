// lib/api/users.ts
// 역할: 사용자 관리 + 시험 매핑 API 함수 모음 (관리자 전용)

import { apiClient } from './client';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  _count: { submissions: number; userExams: number };
}

export interface AssignedUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface BulkUserInput {
  name: string;
  email: string;
  password: string;
  role?: 'USER' | 'ADMIN';
}

export interface BulkUserResult {
  success: number;
  failed: { email: string; reason: string }[];
}

export const usersApi = {
  // 전체 사용자 목록
  getAll: () => apiClient.get<UserSummary[]>('/users'),

  // 사용자 직접 생성
  create: (data: { email: string; password: string; name: string; role?: 'USER' | 'ADMIN' }) =>
    apiClient.post<UserSummary>('/users', data),

  // 사용자 일괄 생성 (엑셀 업로드용)
  bulkCreate: (users: BulkUserInput[]) =>
    apiClient.post<BulkUserResult>('/users/bulk', { users }),

  // role 변경
  updateRole: (userId: string, role: 'USER' | 'ADMIN') =>
    apiClient.patch<UserSummary>(`/users/${userId}/role`, { role }),

  // 사용자 삭제
  delete: (userId: string) => apiClient.delete(`/users/${userId}`),

  // 시험에 할당된 사용자 목록
  getByExam: (examId: string) => apiClient.get<AssignedUser[]>(`/exams/${examId}/users`),

  // 시험에 사용자 할당
  assignToExam: (examId: string, userId: string) =>
    apiClient.post(`/exams/${examId}/users`, { userId }),

  // 시험에서 사용자 할당 해제
  removeFromExam: (examId: string, userId: string) =>
    apiClient.delete(`/exams/${examId}/users/${userId}`),
};
