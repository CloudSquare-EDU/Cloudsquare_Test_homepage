// lib/api/auth.ts
// 역할: 인증 관련 API 함수 모음

import { apiClient } from './client';
import { AuthResponse } from '../types';

export interface FoundAccount {
  courseName: string | null;
  email: string;
  ncpAccountId: string | null;
}

// 회원가입 API는 없음 — 계정은 관리자가 직접 생성한다 (app/auth/register 페이지는 안내용).
export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', data, { skipAuth: true }),

  // ID 찾기 (이름 + 학번) — 로그인 전에도 호출 가능
  findAccount: (data: { name: string; studentNumber: string }) =>
    apiClient.post<{ accounts: FoundAccount[] }>('/auth/find-account', data, { skipAuth: true }),
};
