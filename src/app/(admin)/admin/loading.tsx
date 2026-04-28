import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-2xl" />
        <Skeleton className="h-10 w-28 rounded-2xl" />
      </div>
      <div className="surface-card rounded-xl p-3">
        <div className="border-b border-border/45 p-3">
          <div className="flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16 rounded-full" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-border/30 p-3 last:border-b-0">
            <div className="flex gap-8">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-20 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
