// app.ts
// 역할: Express 앱 설정 — CORS, JSON 파싱, 라우트 등록, 에러 핸들러 연결

import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './routes/authRoutes';
import { examRoutes } from './routes/examRoutes';
import { questionRoutes } from './routes/questionRoutes';
import { submissionRoutes } from './routes/submissionRoutes';
import { userRoutes } from './routes/userRoutes';

export const createApp = (): express.Application => {
  const app = express();

  // ─── CORS 설정 ───────────────────────────────────────────
  // Netlify 프론트엔드 도메인만 허용
  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    }),
  );

  // ─── Body Parser ─────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── Health Check ─────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  // ─── API 라우트 ────────────────────────────────────────────
  app.use('/auth', authRoutes);
  app.use('/exams', examRoutes);
  app.use('/questions', questionRoutes);
  app.use('/submissions', submissionRoutes);
  app.use('/users', userRoutes);

  // ─── 404 핸들러 ────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '요청한 리소스를 찾을 수 없습니다.' },
    });
  });

  // ─── 통합 에러 핸들러 (반드시 마지막에 위치) ────────────────
  app.use(errorHandler);

  return app;
};
