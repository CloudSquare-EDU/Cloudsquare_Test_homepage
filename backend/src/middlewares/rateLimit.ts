// rateLimit.ts
// 역할: 의존성 없이 쓰는 간단한 IP 기반 요청 횟수 제한 (인메모리, 서버 1대 구성 기준)
// 용도: 로그인 없이 호출되는 ID 찾기 API 가 학번 무작위 대입(스캔)에 쓰이지 않도록 막는다.

import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export const createRateLimiter = (opts: { windowMs: number; max: number; message: string }) => {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    // 만료된 버킷 정리 (맵이 무한히 커지지 않도록)
    if (buckets.size > 5000) {
      for (const [key, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(key);
      }
    }

    const key = req.ip ?? 'unknown';
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: opts.message },
      });
      return;
    }
    next();
  };
};
