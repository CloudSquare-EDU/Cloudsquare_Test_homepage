// server.ts
// 역할: HTTP 서버 시작 진입점 — Railway는 이 파일을 기준으로 실행

import 'dotenv/config';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const start = async (): Promise<void> => {
  // DB 연결 확인
  await prisma.$connect();
  console.log('[DB] PostgreSQL 연결 성공');

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`[Server] http://localhost:${PORT} 에서 실행 중 (${process.env.NODE_ENV})`);
  });
};

start().catch((err) => {
  console.error('[Server] 시작 실패:', err);
  process.exit(1);
});
