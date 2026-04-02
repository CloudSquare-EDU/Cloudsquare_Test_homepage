'use client';

import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function SubmissionsError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-sm text-[var(--danger-text)]">응시 기록을 불러오는 데 실패했습니다.</p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={reset}>다시 시도</Button>
        <Link href="/"><Button variant="ghost" size="sm">홈으로</Button></Link>
      </div>
    </div>
  );
}
