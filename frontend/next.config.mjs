/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // ─── 보안 헤더 ─────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // XSS 방어
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // HTTPS 강제 (Railway + Netlify 모두 HTTPS 지원)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Referrer 정책
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // 정적 자산 장기 캐시 (Next.js _next/static은 내용 해시 포함)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // ─── 번들 최적화 ───────────────────────────────────────────
  // 사용하지 않는 로케일 제거 (한국어 앱이므로 기본값 유지)
  compress: true, // Next.js 내장 gzip 압축 활성화

  // ─── 이미지 최적화 ─────────────────────────────────────────
  images: {
    formats: ['image/webp'],
  },
};

export default nextConfig;
