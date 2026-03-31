// lib/api/auth.ts
// 역할: 인증 관련 API 함수 모음

import { apiClient } from './client';
import { AuthResponse } from '../types';

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiClient.post<AuthResponse>('/auth/register', data, { skipAuth: true }),

  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', data, { skipAuth: true }),
};
