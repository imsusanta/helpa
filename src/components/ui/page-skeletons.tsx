import { Skeleton, SkeletonCard } from '@/components/dashboard/skeleton';

export function DashboardContentSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="mx-auto w-full max-w-[1536px] space-y-6"
    >
      <span className="sr-only">Loading page...</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border-border bg-card space-y-5 rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>

        <div className="border-border bg-card space-y-5 rounded-xl border p-5">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        </div>
      </div>

      <div className="border-border bg-card space-y-4 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function DashboardShellSkeleton() {
  return (
    <div className="bg-background flex min-h-screen w-full overflow-hidden">
      <aside className="border-border bg-card hidden w-64 shrink-0 space-y-5 border-r p-4 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border bg-card flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="size-9 rounded-full" />
        </div>
        <main className="min-h-0 flex-1 overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
          <DashboardContentSkeleton />
        </main>
      </div>
    </div>
  );
}

export function LandingPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading website"
      className="min-h-screen bg-[#FAF9FC] text-[#110E3D]"
    >
      <span className="sr-only">Loading website...</span>
      <div className="border-b border-slate-200/70 bg-white/90">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <Skeleton className="h-7 w-52 rounded-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-4/5" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-12 w-36 rounded-xl" />
              <Skeleton className="h-12 w-32 rounded-xl" />
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading authentication page"
      className="flex min-h-screen items-center justify-center bg-[#030712] px-4"
    >
      <span className="sr-only">Loading authentication page...</span>
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-xl sm:p-9">
        <div className="flex flex-col items-center gap-3 pb-3">
          <Skeleton className="size-14 rounded-2xl bg-white/10" />
          <Skeleton className="h-7 w-32 bg-white/10" />
          <Skeleton className="h-4 w-56 max-w-full bg-white/10" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
        <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
        <Skeleton className="h-12 w-full rounded-xl bg-emerald-500/20" />
      </div>
    </div>
  );
}
