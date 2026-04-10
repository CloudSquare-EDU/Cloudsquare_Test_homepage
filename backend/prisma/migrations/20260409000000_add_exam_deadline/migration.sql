-- AlterTable: exams에 deadline 컬럼 추가 (nullable)
ALTER TABLE "exams" ADD COLUMN "deadline" TIMESTAMP(3);
