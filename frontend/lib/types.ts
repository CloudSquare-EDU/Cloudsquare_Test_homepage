// lib/types.ts
// 역할: Frontend 전반에서 사용하는 타입 정의
// 설계 이유: Backend API 응답 구조와 1:1 대응하는 타입을 중앙 관리

export type Role = 'USER' | 'ADMIN';

// ─── Auth ────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// ─── Exam ────────────────────────────────────────────────────
export interface ExamSummary {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  questionCount: number;
  isPublished?: boolean;
  createdAt: string;
}

export interface Choice {
  id: string;
  content: string;
  order: number;
}

export interface Question {
  id: string;
  content: string;
  order: number;
  choices: Choice[];
}

export interface ExamDetail {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  isPublished: boolean;
  questions: Question[];
}

// ─── Submission ──────────────────────────────────────────────
export interface AnswerInput {
  questionId: string;
  choiceId: string;
}

export interface GradedAnswer {
  questionId: string;
  choiceId: string;
  isCorrect: boolean;
  correctChoiceId: string | undefined;
}

export interface SubmissionResult {
  submissionId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  answers: GradedAnswer[];
}

export interface SubmissionSummary {
  id: string;
  score: number | null;
  totalQuestions: number;
  submittedAt: string;
  exam: {
    id: string;
    title: string;
  };
}

export interface SubmissionDetail extends SubmissionSummary {
  answers: Array<{
    questionId: string;
    isCorrect: boolean;
    question: {
      id: string;
      content: string;
      choices: Array<Choice & { isCorrect: boolean }>;
    };
    choice: Choice;
  }>;
}

// ─── API 응답 공통 래퍼 ──────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ─── 관리자 시험 목록 ─────────────────────────────────────────
export interface AdminExam extends ExamSummary {
  isPublished: boolean;
  _count: {
    questions: number;
    submissions: number;
  };
}

// ─── 관리자 응시 결과 ─────────────────────────────────────────
export interface AdminSubmissionSummary {
  id: string;
  score: number | null;
  totalQuestions: number;
  submittedAt: string;
  user: { id: string; name: string; email: string };
  exam: { id: string; title: string };
}

// 특정 사용자의 시험별 응시 현황
export interface UserExamStatus {
  examId: string;
  examTitle: string;
  duration: number;
  submitted: boolean;
  submission: {
    id: string;
    score: number | null;
    totalQuestions: number;
    submittedAt: string;
  } | null;
}

export interface UserSubmissionStatus {
  user: { id: string; name: string; email: string };
  exams: UserExamStatus[];
}

// 특정 시험의 사용자별 응시 현황
export interface ExamUserStatus {
  userId: string;
  userName: string;
  userEmail: string;
  submitted: boolean;
  submission: {
    id: string;
    score: number | null;
    totalQuestions: number;
    submittedAt: string;
  } | null;
}

export interface ExamSubmissionStatus {
  exam: { id: string; title: string; duration: number };
  users: ExamUserStatus[];
}
