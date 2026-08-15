import { SectionHeader } from "./movie-list";

/** Neutral placeholder block used while a streamed section is still loading. */
export function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-[var(--line)] ${className}`} aria-hidden />;
}

export function SectionSkeleton({ title, rows = 3 }: { title: string; rows?: number }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={title} />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Shimmer key={i} className="h-12 w-full opacity-40" />
        ))}
      </div>
    </section>
  );
}

export function CarouselSkeleton({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={title} />
      <div className="no-scrollbar -mx-5 flex gap-4 overflow-hidden px-5 py-1">
        {Array.from({ length: 4 }, (_, i) => (
          <Shimmer key={i} className="h-48 w-32 shrink-0 opacity-40" />
        ))}
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="Tonight For You" />
      <div className="flex gap-5">
        <Shimmer className="h-48 w-32 shrink-0 opacity-40" />
        <div className="flex flex-1 flex-col gap-3">
          <Shimmer className="h-7 w-3/4 opacity-40" />
          <Shimmer className="h-4 w-1/2 opacity-40" />
          <Shimmer className="mt-auto h-10 w-24 opacity-40" />
        </div>
      </div>
    </section>
  );
}
