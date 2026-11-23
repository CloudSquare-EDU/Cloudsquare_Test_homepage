// app.ts
// 역할: Express 앱 설정 — CORS, JSON 파싱, 라우트 등록, 에러 핸들러 연결

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import 'dotenv/config';

import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './routes/authRoutes';
import { courseRoutes } from './routes/courseRoutes';
import { examRoutes } from './routes/examRoutes';
import { questionBankRoutes } from './routes/questionBankRoutes';
import { questionRoutes } from './routes/questionRoutes';
import { submissionRoutes } from './routes/submissionRoutes';
import { userRoutes } from './routes/userRoutes';

export const createApp = (): express.Application => {
  const app = express();

  // ─── 리버스 프록시(nginx) 뒤에서 실제 접속자 IP 인식 ──────────
  // TRUST_PROXY=1 이면 X-Forwarded-For 의 클라이언트 IP를 req.ip 로 사용한다.
  // (ID 찾기 횟수 제한이 프록시 IP 하나로 묶이는 문제 방지)
  // 설정하지 않으면 기존 동작과 동일. 3001 포트가 외부에 직접 열려 있으면 켜지 말 것.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true');
  }

  // ─── Gzip 압축 (응답 크기 50~70% 감소) ──────────────────────
  app.use(compression());

  // ─── CORS 설정 ───────────────────────────────────────────
  // Netlify 프론트엔드 도메인만 허용
  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    }),
  );

  // ─── Body Parser (요청 크기 1MB 제한) ────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Health Check ─────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  // ─── API 라우트 ────────────────────────────────────────────
  app.use('/auth', authRoutes);
  app.use('/courses', courseRoutes);
  app.use('/exams', examRoutes);
  app.use('/question-banks', questionBankRoutes);
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
