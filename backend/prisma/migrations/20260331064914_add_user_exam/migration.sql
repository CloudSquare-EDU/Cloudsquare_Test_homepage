-- CreateTable
CREATE TABLE "user_exams" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_exams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_exams_userId_idx" ON "user_exams"("userId");

-- CreateIndex
CREATE INDEX "user_exams_examId_idx" ON "user_exams"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "user_exams_userId_examId_key" ON "user_exams"("userId", "examId");

-- AddForeignKey
ALTER TABLE "user_exams" ADD CONSTRAINT "user_exams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exams" ADD CONSTRAINT "user_exams_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
