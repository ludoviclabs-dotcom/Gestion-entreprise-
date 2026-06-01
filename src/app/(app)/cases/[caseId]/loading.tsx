import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <div className="flex-1">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
