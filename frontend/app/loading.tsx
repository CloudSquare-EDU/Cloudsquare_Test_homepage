// app/loading.tsx
// Next.js App Router 자동 Suspense 로딩 UI
// 페이지 컴포넌트가 로드되는 동안 자동으로 렌더링됨

export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2] border-t-transparent" />
    </div>
  );
}
