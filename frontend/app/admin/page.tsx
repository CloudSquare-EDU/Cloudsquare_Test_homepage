// app/admin/page.tsx
// 역할: 관리자 메인 대시보드 — 모든 관리 기능의 진입점

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';

interface AdminMenuCard {
  title: string;
  description: string;
  href: string;
  icon: string;
}

const MENU_CARDS: AdminMenuCard[] = [
  {
    title: '시험 관리',
    description: '모의시험을 생성하고 문제를 등록합니다. 사용자에게 시험을 개별 할당하여 접근을 제어합니다.',
    href: '/admin/exams',
    icon: '📝',
  },
  {
    title: '사용자 관리',
    description: '사용자 계정을 생성하고 권한을 관리합니다. 각 사용자에게 시험을 배정할 수 있습니다.',
    href: '/admin/users',
    icon: '👥',
  },
  {
    title: '응시 결과 관리',
    description: '사용자별 시험 응시 현황과 점수를 확인합니다. 필요 시 재응시를 허용할 수 있습니다.',
    href: '/admin/results',
    icon: '📊',
  },
];

export default function AdminDashboard() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.push('/auth/login'); return; }
    if (user.role !== 'ADMIN') { router.push('/'); }
  }, [user, isInitialized, router]);

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="mt-1 text-gray-500">모의시험 플랫폼의 모든 관리 기능을 사용할 수 있습니다.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {MENU_CARDS.map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="group h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-400 hover:shadow-md">
              <div className="mb-3 text-4xl">{card.icon}</div>
              <h2 className="mb-1 text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                {card.title}
              </h2>
              <p className="text-sm text-gray-500">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
