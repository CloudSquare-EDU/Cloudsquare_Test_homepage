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
        <label htmlFor={inputId} className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`
          h-8 w-full rounded-md border bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]
          placeholder:text-[var(--text-faint)]
          transition-colors
          focus:outline-none focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]
          disabled:bg-[var(--bg-inset)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed
          ${error
            ? 'border-[var(--danger-text)] focus:border-[var(--danger-text)] focus:ring-[var(--danger-text)]'
            : 'border-[var(--border)] hover:border-[var(--border-hover)]'
          }
          ${className}
        `}
      />
      {error && <p className="text-xs text-[var(--danger-text)]">{error}</p>}
    </div>
  );
};
