-- CreateEnum: 시험 유형 (자기주도학습 / 실제 시험)
CREATE TYPE "ExamType" AS ENUM ('SELF_STUDY', 'REAL_EXAM');

-- AlterTable: exams에 examType 컬럼 추가 (기존 시험은 전부 자기주도학습으로 취급)
ALTER TABLE "exams" ADD COLUMN "examType" "ExamType" NOT NULL DEFAULT 'SELF_STUDY';
