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
  mustChangePassword?: boolean;
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
  questionCount: number | null;
  isPublished?: boolean;
  startDate?: string | null;
  deadline?: string | null;
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
  questionBankId: string | null;
  questionCount: number | null;
  questionBank: { id: string; name: string } | null;
  isBankBased: boolean;
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

// 백엔드에서 문제별로 가공된 응시 결과 (questionResults)
export interface QuestionResult {
  key: string;         // questionId 또는 bankQuestionId
  content: string;     // 문제 내용
  isCorrect: boolean;
  isAnswered: boolean; // 미응답(타이머 만료) 여부
  choices: Array<{
    id: string;
    content: string;
    isCorrect: boolean;  // 정답 여부
    isSelected: boolean; // 사용자 선택 여부
  }>;
}

export interface SubmissionDetail {
  id: string;
  exam: { id: string; title: string; duration: number };
  score: number | null;
  totalQuestions: number;
  submittedAt: string;
  questionResults: QuestionResult[];
}

// 홈 화면용 — 시험 + 응시 여부 통합 타입 (GET /exams/my)
export interface ExamWithSubmission extends ExamSummary {
  submission: {
    id: string;
    score: number | null;
    totalQuestions: number;
    submittedAt: string;
  } | null;
}

// ─── Question Bank ───────────────────────────────────────────
export interface BankChoiceSummary {
  id: string;
  content: string;
  isCorrect: boolean;
  order: number;
}

export interface BankQuestionSummary {
  id: string;
  content: string;
  order: number;
  choices: BankChoiceSummary[];
}

export interface QuestionBankSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { questions: number; exams: number };
}

export interface QuestionBankDetail extends QuestionBankSummary {
  questions: BankQuestionSummary[];
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
  questionBankId: string | null;
  questionCount: number | null;
  questionBank: { id: string; name: string; _count: { questions: number } } | null;
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

// 관리자용: 사용자별 배정 문제
export interface AssignedQuestion {
  order: number;
  id: string;
  content: string;
  choices: Array<{
    id: string;
    content: string;
    isCorrect: boolean;
    order: number;
  }>;
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
  examId: string;
  examTitle: string;
  users: ExamUserStatus[];
}
