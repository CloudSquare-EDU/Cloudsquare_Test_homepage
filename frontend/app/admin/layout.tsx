// app/admin/layout.tsx
// 역할: 모든 /admin/* 페이지에 공통 적용되는 인증/권한 가드
// 설계 이유: 개별 페이지마다 auth 체크를 중복 구현하는 대신 레이아웃에서 한 번에 처리
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.push('/auth/login'); return; }
    if (user.role !== 'ADMIN') { router.push('/'); }
  }, [user, isInitialized, router]);

  // 초기화 전 또는 권한 없으면 아무것도 렌더링하지 않음
  if (!isInitialized || !user || user.role !== 'ADMIN') return null;

  return <>{children}</>;
}
