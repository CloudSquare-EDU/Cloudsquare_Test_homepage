// components/ui/Timer.tsx
'use client';

interface TimerProps {
  formattedTime: string;
  isWarning: boolean;
}

export const Timer = ({ formattedTime, isWarning }: TimerProps) => {
  return (
    <div
      className={`
        inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-sm font-semibold tabular-nums
        transition-colors
        ${isWarning
          ? 'animate-pulse border border-red-800/60 bg-red-950/60 text-red-400'
          : 'border border-[rgba(255,255,255,0.09)] bg-[#1e1e28] text-[#ededf0]'
        }
      `}
    >
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {formattedTime}
      {isWarning && <span className="text-xs font-normal text-red-500">주의</span>}
    </div>
  );
};
