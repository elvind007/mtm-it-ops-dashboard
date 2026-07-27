import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface LoadingDataProps {
  rows?: number
  className?: string
}

export function LoadingData({ rows = 4, className }: LoadingDataProps) {
  return (
    <div
      className={cn("min-h-64 rounded-lg border bg-background p-5", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading data"
    >
      <span className="sr-only">Loading data…</span>
      <div aria-hidden="true">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="size-9" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-[2fr_1fr_4rem] items-center gap-4 border-t pt-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-full max-w-40" />
              </div>
              <Skeleton className="h-3 w-full max-w-24" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
