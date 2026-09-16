// lib/api/auth.ts
// 역할: 인증 관련 API 함수 모음

import { apiClient } from './client';
import { AuthResponse } from '../types';

// 회원가입 API는 없음 — 계정은 관리자가 직접 생성한다 (app/auth/register 페이지는 안내용).
export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', data, { skipAuth: true }),
};
