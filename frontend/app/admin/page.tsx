// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { examsApi } from '@/lib/api/exams';
import { submissionsApi } from '@/lib/api/submissions';
import { usersApi } from '@/lib/api/users';
import { coursesApi } from '@/lib/api/courses';
import { AdminExam, ExamSubmissionStatus, CourseSummary } from '@/lib/types';
import { scoreColor } from '@/lib/utils';

interface DashboardStats {
  totalUsers: number;
  totalExams: number;
  totalSubmissions: number;
  avgScore: number | null;
  submissionRate: number | null;
}

interface RecentSubmission {
  userName: string;
  examTitle: string;
  score: number | null;
  submittedAt: string;
}

const NAV_CARDS = [
  {
    title: '문제은행',
    description: '문제 등록, 선택지 관리',
    href: '/admin/question-banks',
    shortcut: 'G B',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 6h12M2 6l6-4 6 4M2 6v1h12V6M3 7v5M6 7v5M10 7v5M13 7v5M2 12h12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: '과정 관리',
    description: '과정 생성, 사용자·시험 배정',
    href: '/admin/courses',
    shortcut: 'G C',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 2L1 5.5l7 3.5 7-3.5L8 2z" strokeLinejoin="round" />
        <path d="M1 5.5v4M4 7.2v3.3c0 1 1.79 1.8 4 1.8s4-.8 4-1.8V7.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '시험 관리',
    description: '시험 생성, 문제 등록, 사용자 할당',
    href: '/admin/exams',
    shortcut: 'G E',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
        <path d="M10 2v3h3" strokeLinejoin="round" />
        <path d="M5 8h6M5 11h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '사용자 관리',
    description: '계정 생성, 권한 설정, 시험 할당',
    href: '/admin/users',
    shortcut: 'G U',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="6" cy="5" r="2.5" />
        <path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5" strokeLinecap="round" />
        <path d="M11 7a2 2 0 100-4M15 13c0-2-1.34-3.7-3.2-4.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '응시 결과',
    description: '점수 확인, 재응시 허용',
    href: '/admin/results',
    shortcut: 'G R',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 12l3-4 3 2 3-5 3 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 14h12" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function AdminDashboard() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // 원본 데이터 (필터링용)
  const [rawData, setRawData] = useState<{
    exams: AdminExam[];
    statuses: Array<{ examId: string; status: ExamSubmissionStatus }>;
    userCount: number;
    courseUserCounts: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.push('/auth/login'); return; }
    if (user.role !== 'ADMIN') { router.push('/'); return; }

    const loadStats = async () => {
      try {
        const [examsRes, usersRes, coursesRes] = await Promise.all([
          examsApi.getAllAdmin({ limit: 200 }),
          usersApi.getAll({ limit: 200 }),
          coursesApi.getAll({ limit: 200 }),
        ]);

        const exams = examsRes.data;
        const users = usersRes.data;
        const courseList = coursesRes.data;

        setCourses(courseList);

        // 각 시험의 응시 현황 로드
        const statuses: Array<{ examId: string; status: ExamSubmissionStatus }> = [];
        for (const exam of exams) {
          try {
            const status = await submissionsApi.getByExam(exam.id);
            statuses.push({ examId: exam.id, status });
          } catch { /* 무시 */ }
        }

        // 과정별 사용자 수
        const courseUserCounts: Record<string, number> = {};
        for (const c of courseList) {
          courseUserCounts[c.id] = c._count.users;
        }

        setRawData({ exams, statuses, userCount: users.filter((u) => u.role === 'USER').length, courseUserCounts });
        computeStats(exams, statuses, users.filter((u) => u.role === 'USER').length, '');
      } catch { /* 무시 */ }
      finally { setIsLoading(false); }
    };

    const computeStats = (
      exams: AdminExam[],
      statuses: Array<{ examId: string; status: ExamSubmissionStatus }>,
      totalUsers: number,
      courseId: string,
    ) => {
      const filteredExams = courseId ? exams.filter((e) => e.courseId === courseId) : exams;
      const filteredExamIds = new Set(filteredExams.map((e) => e.id));

      let totalSubmitted = 0;
      let totalAssigned = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      const recent: RecentSubmission[] = [];

      for (const { examId, status } of statuses) {
        if (!filteredExamIds.has(examId)) continue;
        const exam = exams.find((e) => e.id === examId);
        if (!exam) continue;
        for (const u of status.users) {
          totalAssigned++;
          if (u.submitted && u.submission) {
            totalSubmitted++;
            if (u.submission.score !== null) {
              scoreSum += u.submission.score;
              scoreCount++;
            }
            recent.push({ userName: u.userName, examTitle: exam.title, score: u.submission.score, submittedAt: u.submission.submittedAt });
          }
        }
      }

      recent.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      setStats({
        totalUsers: courseId
          ? (statuses.find((s) => filteredExamIds.has(s.examId))?.status.users.length ?? totalUsers)
          : totalUsers,
        totalExams: filteredExams.length,
        totalSubmissions: totalSubmitted,
        avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
        submissionRate: totalAssigned > 0 ? Math.round((totalSubmitted / totalAssigned) * 100) : null,
      });
      setRecentSubmissions(recent.slice(0, 8));
    };

    loadStats();
  }, [user, isInitialized, router]);

  // 과정 필터 변경 시 통계 재계산
  useEffect(() => {
    if (!rawData) return;
    const { exams, statuses, userCount } = rawData;

    const filteredExams = selectedCourseId ? exams.filter((e) => e.courseId === selectedCourseId) : exams;
    const filteredExamIds = new Set(filteredExams.map((e) => e.id));

    let totalSubmitted = 0, totalAssigned = 0, scoreSum = 0, scoreCount = 0;
    const recent: RecentSubmission[] = [];

    for (const { examId, status } of statuses) {
      if (!filteredExamIds.has(examId)) continue;
      const exam = exams.find((e) => e.id === examId);
      if (!exam) continue;
      for (const u of status.users) {
        totalAssigned++;
        if (u.submitted && u.submission) {
          totalSubmitted++;
          if (u.submission.score !== null) { scoreSum += u.submission.score; scoreCount++; }
          recent.push({ userName: u.userName, examTitle: exam.title, score: u.submission.score, submittedAt: u.submission.submittedAt });
        }
      }
    }

    recent.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    // 과정 선택 시 해당 과정 사용자 수
    const courseUserCount = selectedCourseId
      ? (courses.find((c) => c.id === selectedCourseId)?._count.users ?? 0)
      : userCount;

    setStats({
      totalUsers: courseUserCount,
      totalExams: filteredExams.length,
      totalSubmissions: totalSubmitted,
      avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
      submissionRate: totalAssigned > 0 ? Math.round((totalSubmitted / totalAssigned) * 100) : null,
    });
    setRecentSubmissions(recent.slice(0, 8));
  }, [selectedCourseId, rawData, courses]);

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">대시보드</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">안녕하세요, {user.name}님</p>
        </div>
        {courses.length > 0 && (
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#5e6ad2] transition-colors"
          >
            <option value="">전체 과정</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: selectedCourseId ? '과정 사용자' : '총 사용자', value: stats?.totalUsers ?? '-', sub: selectedCourseId ? '해당 과정' : '일반 계정' },
          { label: selectedCourseId ? '과정 시험' : '총 시험', value: stats?.totalExams ?? '-', sub: selectedCourseId ? '해당 과정' : '등록된 시험' },
          { label: '응시율', value: stats?.submissionRate != null ? `${stats.submissionRate}%` : '-', sub: selectedCourseId ? '과정 평균' : '전체 평균' },
          { label: '평균 점수', value: stats?.avgScore != null ? `${stats.avgScore}점` : '-', sub: '응시자 기준' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-4">
            <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
              {isLoading ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-[var(--bg-raised)]" /> : card.value}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-faint)]">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        {/* 네비게이션 카드 */}
        <div className="flex flex-col gap-3 sm:col-span-2">
          {NAV_CARDS.map((card) => (
            <Link key={card.href} href={card.href}>
              <div className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-raised)]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-raised)] text-[#5e6ad2] group-hover:bg-[#262648]">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-medium text-[var(--text-primary)]">{card.title}</h2>
                  <p className="text-xs text-[var(--text-muted)] truncate">{card.description}</p>
                </div>
                <kbd className="shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-faint)]">
                  {card.shortcut}
                </kbd>
              </div>
            </Link>
          ))}
        </div>

        {/* 최근 응시 현황 */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] sm:col-span-3">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">최근 응시 현황</p>
            <p className="text-xs text-[var(--text-muted)]">최근 응시된 시험 순서</p>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-[var(--bg-raised)]" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-[var(--bg-raised)]" />
                </div>
              ))
            ) : recentSubmissions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-[var(--text-muted)]">응시 기록이 없습니다</p>
              </div>
            ) : (
              recentSubmissions.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-raised)] text-[10px] font-bold text-[#5e6ad2]">
                    {s.userName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                      {s.userName}
                      <span className="ml-1.5 font-normal text-[var(--text-faint)]">{s.examTitle}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold ${scoreColor(s.score)}`}>
                    {s.score != null ? `${s.score}점` : '-'}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--text-faint)]">
                    {new Date(s.submittedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
          {recentSubmissions.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] px-5 py-2 text-center">
              <Link href="/admin/results">
                <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  전체 보기 →
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
