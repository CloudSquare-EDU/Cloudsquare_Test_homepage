-- AlterTable: users에 학번 / 네이버클라우드(NCP) 실습 계정 ID 컬럼 추가 (둘 다 선택 입력)
ALTER TABLE "users" ADD COLUMN "studentNumber" TEXT;
ALTER TABLE "users" ADD COLUMN "ncpAccountId" TEXT;

-- CreateIndex: ID 찾기(이름 + 학번 조회)용
CREATE INDEX "users_studentNumber_idx" ON "users"("studentNumber");
