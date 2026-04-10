// components/ui/Sidebar.tsx
// Linear-style 사이드바 — G+키 단축키, Cmd+K 커맨드 팔레트 포함
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { usersApi } from '@/lib/api/users';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api/client';
import { useTheme } from '@/components/ui/ThemeProvider';

// ─── Icons ───────────────────────────────────────────────────

const IcGrid = () => (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

const IcDoc = () => (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
    <path d="M10 2v3h3" strokeLinejoin="round" />
    <path d="M5 8h6M5 11h4" strokeLinecap="round" />
  </svg>
);

const IcUsers = () => (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="5" r="2.5" />
    <path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5" strokeLinecap="round" />
    <path d="M11 7a2 2 0 100-4M15 13c0-2-1.34-3.7-3.2-4.35" strokeLinecap="round" />
  </svg>
);

const IcChart = () => (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12l3-4 3 2 3-5 3 3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 14h12" strokeLinecap="round" />
  </svg>
);

const IcHistory = () => (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3l2 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IcCourse = () => (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 2L1 5.5l7 3.5 7-3.5L8 2z" strokeLinejoin="round" />
    <path d="M1 5.5v4M4 7.2v3.3c0 1 1.79 1.8 4 1.8s4-.8 4-1.8V7.2" strokeLinecap="round" />
  </svg>
);

const IcBank = () => (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 6h12M2 6l6-4 6 4M2 6v1h12V6M3 7v5M6 7v5M10 7v5M13 7v5M2 12h12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IcLogout = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Nav config ──────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  shortcutKey: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const USER_NAV: NavItem[] = [
  { label: '시험 목록', href: '/', shortcutKey: 'e', exact: true, icon: <IcDoc /> },
  { label: '내 결과', href: '/submissions', shortcutKey: 'r', icon: <IcHistory /> },
];

const ADMIN_NAV: NavItem[] = [
  { label: '대시보드', href: '/admin', shortcutKey: 'h', exact: true, icon: <IcGrid /> },
  { label: '문제은행', href: '/admin/question-banks', shortcutKey: 'b', icon: <IcBank /> },
  { label: '과정 관리', href: '/admin/courses', shortcutKey: 'c', icon: <IcCourse /> },
  { label: '시험 관리', href: '/admin/exams', shortcutKey: 'e', icon: <IcDoc /> },
  { label: '사용자 관리', href: '/admin/users', shortcutKey: 'u', icon: <IcUsers /> },
  { label: '응시 결과', href: '/admin/results', shortcutKey: 'r', icon: <IcChart /> },
];

// ─── Command Palette ─────────────────────────────────────────

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  onLogout: () => void;
}

const CommandPalette = ({ isOpen, onClose, navItems, onLogout }: CommandPaletteProps) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const filtered = query.trim()
    ? navItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : navItems;

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-[var(--border-hover)] bg-[var(--bg-surface)] shadow-2xl">
        {/* 검색 */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-[var(--text-muted)]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M11 11l3 3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이동할 페이지 검색..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none"
          />
          <kbd className="rounded border border-[var(--border-hover)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">Esc</kbd>
        </div>

        {/* 메뉴 목록 */}
        <div className="py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--text-muted)]">검색 결과 없음</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span className="text-[var(--text-muted)]">{item.icon}</span>
                {item.label}
                <span className="ml-auto font-mono text-xs text-[var(--text-faint)]">G {item.shortcutKey.toUpperCase()}</span>
              </button>
            ))
          )}
          <div className="mx-3 my-1.5 border-t border-[var(--border-subtle)]" />
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] transition-colors"
          >
            <IcLogout />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar ─────────────────────────────────────────────────

export const Sidebar = () => {
  const { user, clearAuth } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [showPalette, setShowPalette] = useState(false);
  const [gPending, setGPending] = useState(false);

  // 비밀번호 변경 모달
  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  const openPwModal = () => {
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setPwError(null); setPwSuccess(false);
    setShowPwModal(true);
  };

  const handleChangePw = async () => {
    if (newPw.length < 8) { setPwError('새 비밀번호는 8자 이상이어야 합니다.'); return; }
    if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않습니다.'); return; }
    setIsChangingPw(true); setPwError(null);
    try {
      await usersApi.changeMyPassword(currentPw, newPw);
      setPwSuccess(true);
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsChangingPw(false);
    }
  };

  const navItems = user?.role === 'ADMIN' ? ADMIN_NAV : USER_NAV;

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const handleLogout = useCallback(() => {
    clearAuth();
    router.push('/auth/login');
  }, [clearAuth, router]);

  // Keyboard shortcuts
  useEffect(() => {
    let gTimeout: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      // Cmd+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette((v) => !v);
        return;
      }

      // Ignore when in input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'g') {
        setGPending(true);
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => setGPending(false), 1200);
        return;
      }

      if (gPending) {
        clearTimeout(gTimeout);
        setGPending(false);
        const item = navItems.find((n) => n.shortcutKey === e.key);
        if (item) {
          router.push(item.href);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(gTimeout);
    };
  }, [gPending, navItems, router]);

  const { theme, toggle: toggleTheme } = useTheme();

  if (!user) return null;

  const initials = user.name.charAt(0).toUpperCase();

  return (
    <>
      <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--sidebar-bg)]">
        {/* Logo + Cmd+K */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[#5e6ad2] text-xs font-bold text-white">
              M
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">모의시험사이트</span>
          </div>
          <button
            onClick={() => setShowPalette(true)}
            title="커맨드 팔레트 (Cmd+K)"
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-[var(--text-faint)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <kbd className="font-mono">⌘K</kbd>
          </button>
        </div>

        {/* G-key hint */}
        {gPending && (
          <div className="mx-3 mb-2 rounded-md border border-[#5e6ad2]/40 bg-[#5e6ad2]/10 px-2.5 py-1.5 text-xs text-[#8090d8]">
            단축키 입력 중... (E/R/U/H)
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-1">
          <div className="mb-1 px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-[var(--text-faint)]">
            {user.role === 'ADMIN' ? '관리' : '메뉴'}
          </div>
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors
                  ${active
                    ? 'bg-[var(--bg-raised)] text-[var(--text-primary)]'
                    : 'text-[#8888a8] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                <span className={active ? 'text-[#5e6ad2]' : 'text-[var(--text-muted)] group-hover:text-[#8888a8]'}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                <span className="font-mono text-[10px] text-[var(--border-hover)] group-hover:text-[var(--text-faint)]">
                  G {item.shortcutKey.toUpperCase()}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User info + controls */}
        <div className="border-t border-[var(--border-subtle)] px-3 py-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={openPwModal}
              title="비밀번호 변경"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-raised)] text-xs font-semibold text-[var(--text-secondary)] hover:ring-2 hover:ring-[#5e6ad2]/40 transition-all"
            >
              {initials}
            </button>
            <div className="flex-1 min-w-0">
              <button onClick={openPwModal} className="w-full text-left" title="비밀번호 변경">
                <p className="truncate text-xs font-medium text-[var(--text-primary)] hover:text-[#5e6ad2] transition-colors">{user.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {user.role === 'ADMIN' ? '관리자' : '일반 사용자'}
                </p>
              </button>
            </div>
            {/* 다크/라이트 토글 */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
              className="shrink-0 rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {theme === 'dark' ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="3" />
                  <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
                </svg>
              )}
            </button>
            <button
              onClick={handleLogout}
              title="로그아웃"
              className="shrink-0 rounded p-1 text-[var(--text-faint)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] transition-colors"
            >
              <IcLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* 비밀번호 변경 모달 */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPwModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <p className="font-semibold text-[var(--text-primary)]">비밀번호 변경</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{user.name}</p>
            </div>
            {pwSuccess ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm font-medium text-[var(--success-text)]">비밀번호가 변경되었습니다.</p>
                <button
                  onClick={() => setShowPwModal(false)}
                  className="mt-4 rounded-md bg-[#5e6ad2] px-4 py-1.5 text-sm text-white hover:bg-[#4f5ab8]"
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 px-5 py-4">
                  <Input label="현재 비밀번호" type="password" value={currentPw}
                    onChange={(e) => { setCurrentPw(e.target.value); setPwError(null); }}
                    placeholder="현재 비밀번호" autoFocus />
                  <Input label="새 비밀번호 (8자 이상)" type="password" value={newPw}
                    onChange={(e) => { setNewPw(e.target.value); setPwError(null); }}
                    placeholder="새 비밀번호" />
                  <Input label="새 비밀번호 확인" type="password" value={confirmPw}
                    onChange={(e) => { setConfirmPw(e.target.value); setPwError(null); }}
                    placeholder="새 비밀번호 재입력" />
                  {pwError && <p className="text-xs text-[var(--danger-text)]">{pwError}</p>}
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
                  <Button variant="ghost" size="sm" onClick={() => setShowPwModal(false)}>취소</Button>
                  <Button variant="primary" size="sm" onClick={handleChangePw} disabled={isChangingPw}>
                    {isChangingPw ? '변경 중...' : '변경'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <CommandPalette
        isOpen={showPalette}
        onClose={() => setShowPalette(false)}
        navItems={navItems}
        onLogout={handleLogout}
      />
    </>
  );
};
