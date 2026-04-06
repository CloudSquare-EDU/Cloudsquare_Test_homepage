-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT "answers_choiceId_fkey";

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT "answers_questionId_fkey";

-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "bankChoiceId" TEXT,
ADD COLUMN     "bankQuestionId" TEXT,
ALTER COLUMN "questionId" DROP NOT NULL,
ALTER COLUMN "choiceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "questionBankId" TEXT,
ADD COLUMN     "questionCount" INTEGER;

-- CreateTable
CREATE TABLE "question_banks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_questions" (
    "id" TEXT NOT NULL,
    "questionBankId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_choices" (
    "id" TEXT NOT NULL,
    "bankQuestionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "bank_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_exam_questions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "bankQuestionId" TEXT NOT NULL,
    "assignedOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_questions_questionBankId_idx" ON "bank_questions"("questionBankId");

-- CreateIndex
CREATE INDEX "bank_choices_bankQuestionId_idx" ON "bank_choices"("bankQuestionId");

-- CreateIndex
CREATE INDEX "user_exam_questions_userId_examId_idx" ON "user_exam_questions"("userId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "user_exam_questions_userId_examId_bankQuestionId_key" ON "user_exam_questions"("userId", "examId", "bankQuestionId");

-- CreateIndex
CREATE INDEX "answers_bankQuestionId_idx" ON "answers"("bankQuestionId");

-- CreateIndex
CREATE INDEX "answers_questionId_idx" ON "answers"("questionId");

-- CreateIndex
CREATE INDEX "exams_questionBankId_idx" ON "exams"("questionBankId");

-- CreateIndex
CREATE INDEX "submissions_userId_examId_idx" ON "submissions"("userId", "examId");

-- AddForeignKey
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_choices" ADD CONSTRAINT "bank_choices_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_questions" ADD CONSTRAINT "user_exam_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_questions" ADD CONSTRAINT "user_exam_questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_questions" ADD CONSTRAINT "user_exam_questions_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "question_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "choices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "bank_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_bankChoiceId_fkey" FOREIGN KEY ("bankChoiceId") REFERENCES "bank_choices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
