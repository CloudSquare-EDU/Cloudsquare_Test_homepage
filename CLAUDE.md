# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 프로젝트 개요

Netlify + Railway 기반으로 배포되는 모의시험 웹 애플리케이션.
Frontend(Next.js 14)와 Backend(Express + Prisma)는 완전히 분리된 구조로, 모든 통신은 REST API로 이루어진다.

- **Frontend**: Netlify — Next.js 14 (App Router)
- **Backend**: Railway — Express + Prisma
- **Database**: PostgreSQL (Railway 또는 Neon)

---

## 명령어

### Frontend

```bash
npm run dev      # 개발 서버 실행
npm run build    # 빌드
npm run lint     # ESLint
```

### Backend

```bash
npm run dev          # 개발 서버 실행
npm run build        # 빌드
npm run start        # 프로덕션 실행
npm run db:migrate   # Prisma 마이그레이션
```

---

## 아키텍처

### Frontend 구조

```
/app                    # 페이지 및 레이아웃 (App Router)
/components/ui          # 공통 UI 컴포넌트
/components/domain      # 도메인별 컴포넌트
/lib                    # API 호출 및 유틸리티
```

### Backend 구조

```
/src/controllers        # 요청 처리
/src/services           # 비즈니스 로직
/src/routes             # 라우팅
/src/middlewares        # 공통 미들웨어
/prisma                 # schema 및 마이그레이션
```

---

## 코드 스타일

- TypeScript strict 모드 사용 (`any` 타입 금지)
- `default export` 금지 — `named export`만 사용
- 함수형 컴포넌트 + React Hooks 사용
- TailwindCSS만 사용 (커스텀 CSS 금지)
- 모든 타입은 `interface` 또는 `type`으로 명확히 정의

---

## 데이터 모델

Prisma schema 기준으로 아래 모델을 정의한다:

- `User`
- `Exam`
- `Question`
- `Choice`
- `Submission`
- `Answer`

모든 관계는 Prisma schema에 명확히 선언해야 한다. **Prisma는 Backend에서만 사용**하며, Frontend에서 DB 직접 접근은 금지다.

---

## API 규칙

- RESTful 설계, 모든 요청/응답은 JSON
- 입력값 검증: `zod` 사용
- 에러 응답 형식 표준화 필수
- 인증: JWT Access Token, `Authorization` 헤더 사용

주요 엔드포인트 예시:

```
GET  /exams
POST /exams
POST /auth/login
POST /submissions
```

---

## 환경 변수

- `.env` 파일 커밋 금지
- Frontend / Backend 각각 별도 환경변수 파일 사용
- API URL은 반드시 환경 변수로 관리
- Netlify / Railway 대시보드에 환경 변수 직접 설정

---

## UX 요구사항

- 시험 중 타이머 항상 화면에 표시
- 시험 중 페이지 이탈 방지 처리 (`beforeunload`)
- 제출 전 확인 모달 표시
- 반응형 UI 필수

---

## 작업 방식

**단계적으로 진행하며, 각 단계 완료 후 사용자 확인을 받고 다음 단계로 넘어간다.**

작업 순서:
1. 요구사항 분석
2. 시스템 설계 (아키텍처 + DB 스키마)
3. API 설계
4. Backend 구현
5. Frontend 구현

각 단계는 **설명 → 설계 → 코드** 순서로 진행한다.

---

## 출력 규칙

- 파일 단위로 코드 출력
- 코드 블록 사용
- 코드 역할 및 설계 이유 설명 포함

## 금지 사항

- 설명 없이 코드만 출력 금지
- 전체 프로젝트를 한 번에 생성 금지
- 불필요한 라이브러리 추가 금지
- 타입 정의 없이 구현 금지
