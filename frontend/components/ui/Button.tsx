// components/ui/Button.tsx
'use client';

import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[#5e6ad2] text-white hover:bg-[#6b76da] disabled:bg-[#2e3060] disabled:text-[#6870b0]',
  secondary:
    'border border-[rgba(255,255,255,0.1)] bg-[#1e1e28] text-[#ededf0] hover:bg-[#262636] disabled:opacity-40',
  danger:
    'border border-[rgba(248,113,113,0.2)] bg-[#250d0d] text-[#f87171] hover:bg-[#350f0f] disabled:opacity-40',
  ghost:
    'bg-transparent text-[#9090aa] hover:bg-[#1a1a24] hover:text-[#ededf0] disabled:opacity-40',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) => {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center font-medium rounded-md transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5e6ad2] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0f0f11]
        disabled:cursor-not-allowed select-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {isLoading && (
        <svg
          className="h-3.5 w-3.5 animate-spin shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
};
