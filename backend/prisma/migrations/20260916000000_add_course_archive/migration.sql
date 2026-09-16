-- AlterTable: courses에 보관(archive) 관련 컬럼 추가
ALTER TABLE "courses" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "courses" ADD COLUMN "archivedAt" TIMESTAMP(3);
