// components/domain/auth/AuthInitializer.tsx
// 역할: 앱 최초 로드 시 localStorage에서 인증 상태를 복원하는 클라이언트 컴포넌트

'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';

export const AuthInitializer = () => {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return null;
};
