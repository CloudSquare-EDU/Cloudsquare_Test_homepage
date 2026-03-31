// components/ui/Timer.tsx
// 역할: 시험 타이머 UI — 항상 화면 상단에 고정 표시, 5분 이하 시 빨간색 경고

'use client';

interface TimerProps {
  formattedTime: string;
  isWarning: boolean;
}

export const Timer = ({ formattedTime, isWarning }: TimerProps) => {
  return (
    <div
      className={`
        flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-lg font-bold
        ${isWarning
          ? 'animate-pulse bg-red-100 text-red-600'
          : 'bg-blue-100 text-blue-700'
        }
      `}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{formattedTime}</span>
      {isWarning && <span className="text-sm font-normal">남은 시간 부족!</span>}
    </div>
  );
};
