// lib/store/authStore.ts
// 역할: 전역 인증 상태 관리 (Zustand)
// 설계 이유: Context API 대신 Zustand 사용 — 컴포넌트 외부에서도 상태 접근 가능

'use client';

import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isInitialized: boolean;

  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isInitialized: false,

  // 로그인 성공 시 호출 — localStorage에 토큰 저장
  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, accessToken: token });
  },

  // 로그아웃 시 호출
  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
    set({ user: null, accessToken: null });
  },

  // 앱 시작 시 localStorage에서 복원
  initialize: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      const userStr = localStorage.getItem('user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr) as User;
          set({ user, accessToken: token, isInitialized: true });
          return;
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
      }
    }
    set({ isInitialized: true });
  },
}));
