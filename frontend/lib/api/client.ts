// lib/api/client.ts
// 역할: fetch 기반 HTTP 클라이언트 — Authorization 헤더 자동 주입, 에러 처리 통합
// 설계 이유: 모든 API 호출의 공통 로직(baseURL, 토큰, 에러 파싱)을 한 곳에서 관리

import { ApiResponse } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// localStorage에서 토큰 가져오기 (클라이언트 사이드에서만 실행)
const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
};

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers ?? {}),
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success || !res.ok) {
    throw new ApiError(
      json.error?.code ?? 'UNKNOWN',
      json.error?.message ?? '알 수 없는 오류가 발생했습니다.',
      res.status,
    );
  }

  return json.data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: FetchOptions) =>
    request<T>(path, { method: 'GET', ...options }),

  post: <T>(path: string, body: unknown, options?: FetchOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...options }),

  patch: <T>(path: string, body: unknown, options?: FetchOptions) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),

  delete: <T>(path: string, options?: FetchOptions) =>
    request<T>(path, { method: 'DELETE', ...options }),
};

export { ApiError };
