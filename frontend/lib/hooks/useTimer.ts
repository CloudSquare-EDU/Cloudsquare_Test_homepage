// lib/hooks/useTimer.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  initialSeconds: number;
  onExpire: () => void;
  paused?: boolean; // true면 카운트다운 정지 (인트로 화면에서 사용)
}

interface UseTimerReturn {
  secondsLeft: number;
  formattedTime: string;
  isExpired: boolean;
  isWarning: boolean;
}

export const useTimer = ({ initialSeconds, onExpire, paused = false }: UseTimerOptions): UseTimerReturn => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // initialSeconds가 변경되면(=exam 로드 완료) 초기화
  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  const isExpired = secondsLeft <= 0 && initialSeconds > 0;
  const isWarning = secondsLeft > 0 && secondsLeft <= 300;

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) {
        onExpireRef.current();
        return 0;
      }
      return prev - 1;
    });
  }, []);

  useEffect(() => {
    if (paused) return;
    if (isExpired) return;
    if (initialSeconds === 0) return; // 제한 없음
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tick, isExpired, paused, initialSeconds]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime =
    initialSeconds === 0
      ? '∞'
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { secondsLeft, formattedTime, isExpired, isWarning };
};
