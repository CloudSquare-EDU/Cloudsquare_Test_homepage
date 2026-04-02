// app/admin/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';

const CARDS = [
  {
    title: '시험 관리',
    description: '시험 생성, 문제 등록, 사용자 할당',
    href: '/admin/exams',
    shortcut: 'G E',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
        <path d="M10 2v3h3" strokeLinejoin="round" />
        <path d="M5 8h6M5 11h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '사용자 관리',
    description: '계정 생성, 권한 설정, 시험 할당',
    href: '/admin/users',
    shortcut: 'G U',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="6" cy="5" r="2.5" />
        <path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5" strokeLinecap="round" />
        <path d="M11 7a2 2 0 100-4M15 13c0-2-1.34-3.7-3.2-4.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '응시 결과',
    description: '점수 확인, 재응시 허용',
    href: '/admin/results',
    shortcut: 'G R',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 12l3-4 3 2 3-5 3 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 14h12" strokeLinecap="round" />
      </svg>
    ),
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
        <h1 className="text-xl font-semibold text-[#ededf0]">대시보드</h1>
        <p className="mt-0.5 text-sm text-[#55556a]">
          안녕하세요, {user.name}님
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="group flex h-full flex-col gap-3 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#18181f] p-5 transition-colors hover:border-[rgba(255,255,255,0.14)] hover:bg-[#1e1e28]">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e1e2e] text-[#5e6ad2] group-hover:bg-[#262648]">
                  {card.icon}
                </div>
                <kbd className="rounded border border-[rgba(255,255,255,0.07)] px-1.5 py-0.5 font-mono text-[10px] text-[#44445a]">
                  {card.shortcut}
                </kbd>
              </div>
              <div>
                <h2 className="font-medium text-[#ededf0]">{card.title}</h2>
                <p className="mt-0.5 text-xs text-[#55556a]">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
