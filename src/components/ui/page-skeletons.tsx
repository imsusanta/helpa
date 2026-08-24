import { Skeleton } from '@/components/ui/skeleton';

export function DashboardContentSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="mx-auto w-full max-w-[1536px] space-y-6"
    >
      <span className="sr-only">Loading page...</span>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border-border bg-card space-y-4 rounded-2xl border p-5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="flex h-56 items-end gap-3 sm:gap-5">
            {[42, 68, 52, 84, 61, 76, 48].map((height, index) => (
              <Skeleton
                key={index}
                className="min-w-0 flex-1 rounded-t-lg"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>

        <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <Skeleton className="mb-6 h-5 w-32" />
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="border-border flex items-center justify-between border-b p-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="divide-border divide-y px-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 py-4">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardShellSkeleton() {
  return (
    <div className="bg-background flex min-h-screen w-full overflow-hidden">
      <aside className="border-border bg-card hidden w-64 shrink-0 border-r p-4 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-2 py-1.5">
              <Skeleton className="size-5 rounded" />
              <Skeleton
                className={index % 3 === 0 ? 'h-4 w-32' : 'h-4 w-24'}
              />
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border bg-card flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg lg:hidden" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="hidden h-9 w-44 rounded-lg sm:block" />
            <Skeleton className="size-9 rounded-full" />
          </div>
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
          <div className="hidden items-center gap-6 md:flex">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-16" />
            ))}
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <Skeleton className="h-7 w-52 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full max-w-xl" />
              <Skeleton className="h-12 w-4/5 max-w-lg" />
            </div>
            <Skeleton className="h-5 w-full max-w-xl" />
            <Skeleton className="h-5 w-3/4 max-w-md" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-12 w-36 rounded-xl" />
              <Skeleton className="h-12 w-32 rounded-xl" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton className="mb-5 h-8 w-40" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <Skeleton className="mb-5 size-11 rounded-xl" />
              <Skeleton className="mb-3 h-6 w-40" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
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
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-xl sm:p-9">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Skeleton className="size-14 rounded-2xl bg-white/10" />
          <Skeleton className="h-7 w-32 bg-white/10" />
          <Skeleton className="h-4 w-56 max-w-full bg-white/10" />
        </div>
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 bg-white/10" />
            <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-white/10" />
            <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl bg-emerald-500/20" />
          <Skeleton className="mx-auto h-4 w-48 max-w-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}
