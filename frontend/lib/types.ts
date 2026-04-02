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
  course?: { id: string; name: string } | null;
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
  answerCount: number; // 정답 선택지 수: 1이면 단답형(radio), 2+이면 선다형(checkbox)
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
  choiceIds: string[]; // 복수 정답 지원 — 단답형이면 길이 1
}

export interface GradedAnswer {
  questionId: string;
  choiceIds: string[];        // 사용자가 선택한 선택지 ID 목록
  isCorrect: boolean;
  correctChoiceIds: string[]; // 실제 정답 선택지 ID 목록
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
  // answers: DB에서 선택지 하나당 레코드 1개 저장 → 복수 정답 문제는 여러 레코드
  answers: Array<{
    questionId: string;
    isCorrect: boolean;
    question: {
      id: string;
      content: string;
      choices: Array<Choice & { isCorrect: boolean }>;
    };
    choice: Choice; // 이 레코드에서 선택한 단일 선택지
  }>;
}

// ─── Course ──────────────────────────────────────────────────
export interface CourseSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { users: number; exams: number };
}

export interface CourseDetail {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  users: Array<{ id: string; name: string; email: string; role: Role }>;
  exams: Array<{ id: string; title: string; duration: number; isPublished: boolean }>;
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
  courseId: string | null;
  course: { id: string; name: string } | null;
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
