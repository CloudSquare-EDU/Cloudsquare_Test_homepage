// lib/api/users.ts
// 역할: 사용자 관리 + 시험 매핑 API 함수 모음 (관리자 전용)

import { apiClient } from './client';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  courseId: string | null;
  course: { id: string; name: string } | null;
  mustChangePassword: boolean;
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
  courseName?: string;
}

export interface BulkUserResult {
  success: number;
  updated: number;
  failed: { email: string; reason: string }[];
  courseAssigned: number;
  courseFailed: { email: string; reason: string }[];
}

export interface BulkUserOptions {
  // 이미 존재하는 이메일을 실패 처리하지 않고 덮어쓸지 여부
  overwriteExisting?: boolean;
  // 덮어쓸 때 비밀번호도 엑셀 값으로 교체할지 여부 (기본: 기존 비밀번호 유지)
  overwritePassword?: boolean;
}

export interface ExistingUserInfo {
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  courseName: string | null;
  courseArchived: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usersApi = {
  // 전체 사용자 목록 (페이지네이션)
  getAll: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return apiClient.get<PaginatedResponse<UserSummary>>(`/users${query ? `?${query}` : ''}`);
  },

  // 사용자 직접 생성
  create: (data: { email: string; password: string; name: string; role?: 'USER' | 'ADMIN' }) =>
    apiClient.post<UserSummary>('/users', data),

  // 엑셀 일괄 등록 전, 이미 존재하는 이메일 조회 (덮어쓰기 확인용)
  checkExisting: (emails: string[]) =>
    apiClient.post<{ existing: ExistingUserInfo[] }>('/users/bulk/check', { emails }),

  // 사용자 일괄 생성/덮어쓰기 (엑셀 업로드용)
  bulkCreate: (users: BulkUserInput[], options?: BulkUserOptions) =>
    apiClient.post<BulkUserResult>('/users/bulk', { users, ...options }),

  // role 변경
  updateRole: (userId: string, role: 'USER' | 'ADMIN') =>
    apiClient.patch<UserSummary>(`/users/${userId}/role`, { role }),

  // 관리자가 특정 사용자 비밀번호 초기화
  resetPassword: (userId: string, password: string) =>
    apiClient.patch(`/users/${userId}/password`, { password }),

  // 본인 비밀번호 변경
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    apiClient.patch('/users/me/password', { currentPassword, newPassword }),

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

  // 과정 배정
  assignCourse: (userId: string, courseId: string) =>
    apiClient.patch(`/users/${userId}/course`, { courseId }),

  // 과정 해제
  removeCourse: (userId: string) =>
    apiClient.delete(`/users/${userId}/course`),
};
