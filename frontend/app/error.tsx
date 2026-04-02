// app/error.tsx
// Next.js App Router 전역 에러 바운더리
// 렌더링 중 throw된 에러를 잡아 사용자 친화적 화면으로 대체

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 에러 로깅 (프로덕션에서는 Sentry 등으로 교체)
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="text-3xl">⚠️</div>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">
        페이지를 불러오는 중 오류가 발생했습니다
      </h2>
      <p className="text-sm text-[var(--text-muted)]">
        {error.message ?? '잠시 후 다시 시도해 주세요.'}
      </p>
      <Button size="sm" onClick={reset}>
        다시 시도
      </Button>
    </div>
  );
}
