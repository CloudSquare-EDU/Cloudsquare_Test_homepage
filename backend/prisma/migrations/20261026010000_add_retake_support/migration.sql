-- 재응시(자기주도학습) 지원
-- 1) 과정별 재응시 허용 여부 (기본 false = 기존 동작 유지)
ALTER TABLE "courses" ADD COLUMN "allowRetake" BOOLEAN NOT NULL DEFAULT false;

-- 2) 응시 회차: 기존 응시 기록은 전부 1회차
ALTER TABLE "submissions" ADD COLUMN "attemptNo" INTEGER NOT NULL DEFAULT 1;

-- 3) 문제은행 배정도 회차별로 보관 (회차마다 새로 랜덤 추첨, 이전 회차 문제 세트는 그대로 유지)
ALTER TABLE "user_exam_questions" ADD COLUMN "attemptNo" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "user_exam_questions_userId_examId_bankQuestionId_key";
CREATE UNIQUE INDEX "user_exam_questions_userId_examId_attemptNo_bankQuestionId_key"
  ON "user_exam_questions"("userId", "examId", "attemptNo", "bankQuestionId");
