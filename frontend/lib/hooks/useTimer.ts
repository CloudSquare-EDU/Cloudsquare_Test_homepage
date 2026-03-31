// lib/hooks/useTimer.ts
// 역할: 시험 타이머 커스텀 훅
// 설계 이유: 타이머 로직을 재사용 가능한 훅으로 분리, 만료 시 콜백 자동 호출

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  initialSeconds: number;
  onExpire: () => void;
}

interface UseTimerReturn {
  secondsLeft: number;
  formattedTime: string;
  isExpired: boolean;
  isWarning: boolean; // 남은 시간 5분 이하일 때 true
}

export const useTimer = ({ initialSeconds, onExpire }: UseTimerOptions): UseTimerReturn => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const isExpired = secondsLeft <= 0;
  const isWarning = secondsLeft <= 300 && !isExpired; // 5분 이하

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
    if (isExpired) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tick, isExpired]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { secondsLeft, formattedTime, isExpired, isWarning };
};
