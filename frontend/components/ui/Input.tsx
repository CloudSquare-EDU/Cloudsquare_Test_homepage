// components/ui/Input.tsx
'use client';

import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, id, className = '', ...props }: InputProps) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-[#9090aa] tracking-wide">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`
          h-8 w-full rounded-md border bg-[#18181f] px-3 text-sm text-[#ededf0]
          placeholder:text-[#44445a]
          transition-colors
          focus:outline-none focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]
          disabled:bg-[#111118] disabled:text-[#55556a] disabled:cursor-not-allowed
          ${error
            ? 'border-[#f87171] focus:border-[#f87171] focus:ring-[#f87171]'
            : 'border-[rgba(255,255,255,0.09)] hover:border-[rgba(255,255,255,0.16)]'
          }
          ${className}
        `}
      />
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
    </div>
  );
};
