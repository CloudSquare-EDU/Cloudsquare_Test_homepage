import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Netlify 배포 최적화
  output: 'standalone',
  // API URL은 환경 변수로 관리 (런타임에 접근 가능하도록 publicRuntimeConfig 사용하지 않음)
  // NEXT_PUBLIC_ 접두어로 클라이언트에 노출
};

export default nextConfig;
