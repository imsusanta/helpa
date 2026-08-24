import { Skeleton } from '@/components/dashboard/skeleton';

function ScreenReaderStatus({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

export function InboxPageSkeleton() {
  return (
    <div className="flex h-full min-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white">
      <ScreenReaderStatus label="Loading inbox" />
      <div className="w-full shrink-0 space-y-3 border-r border-slate-200 p-4 lg:w-80">
        <Skeleton className="h-10 w-full rounded-xl" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 py-2">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden min-w-0 flex-1 flex-col lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex-1 space-y-5 p-6">
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-20 w-3/5 rounded-2xl" />
          <Skeleton className="h-14 w-1/2 rounded-2xl" />
        </div>
        <div className="border-t border-slate-200 p-4">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SalesPageSkeleton() {
  return (
    <div className="space-y-6">
      <ScreenReaderStatus label="Loading sales workspace" />
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex gap-3 border-b border-slate-200 p-4">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <div className="space-y-1 p-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-6">
      <ScreenReaderStatus label="Loading analytics" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
