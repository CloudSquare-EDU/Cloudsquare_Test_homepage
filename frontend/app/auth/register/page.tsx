// app/auth/register/page.tsx
// 역할: 공개 회원가입 비활성화 안내 페이지
// 계정 생성은 관리자만 가능 → 관리자에게 문의 안내

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function RegisterPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="mb-4 text-5xl">🔒</div>
        <h1 className="mb-2 text-xl font-bold text-gray-900">회원가입 제한</h1>
        <p className="mb-6 text-sm text-gray-500 leading-relaxed">
          이 서비스는 관리자가 직접 계정을 생성합니다.
          <br />
          계정이 필요하시면 관리자에게 문의해주세요.
        </p>
        <Link href="/auth/login">
          <Button className="w-full">로그인 페이지로</Button>
        </Link>
      </div>
    </div>
  );
}
