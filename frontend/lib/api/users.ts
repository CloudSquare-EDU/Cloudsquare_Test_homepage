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
  studentNumber: string | null;
  ncpAccountId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  _count: { submissions: number; userExams: number };
}

export interface BulkUserInput {
  name: string;
  email: string;
  password: string;
  role?: 'USER' | 'ADMIN';
  courseName?: string;
  studentNumber?: string;
  ncpAccountId?: string;
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
  // courseId: 특정 과정 ID, 또는 'none' = 과정 미배정 / role: 권한 필터
  getAll: (params?: { page?: number; limit?: number; search?: string; courseId?: string; role?: 'USER' | 'ADMIN' }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.courseId) qs.set('courseId', params.courseId);
    if (params?.role) qs.set('role', params.role);
    const query = qs.toString();
    return apiClient.get<PaginatedResponse<UserSummary>>(`/users${query ? `?${query}` : ''}`);
  },

  // 사용자 직접 생성
  create: (data: {
    email: string; password: string; name: string; role?: 'USER' | 'ADMIN';
    studentNumber?: string; ncpAccountId?: string;
  }) => apiClient.post<UserSummary>('/users', data),

  // 이름/학번/NCP 실습 계정 ID 수정 (빈 문자열을 보내면 값 삭제)
  updateProfile: (userId: string, data: { name?: string; studentNumber?: string; ncpAccountId?: string }) =>
    apiClient.patch<UserSummary>(`/users/${userId}/profile`, data),

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

};
