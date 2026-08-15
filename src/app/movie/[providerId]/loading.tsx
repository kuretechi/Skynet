import { Shimmer } from "@/components/skeletons";

/** Shown the instant a poster is tapped, while the detail page streams in. */
export default function Loading() {
  return (
    <div className="min-h-dvh pb-28">
      <div className="mx-auto max-w-3xl px-5">
        <Shimmer className="-mx-5 h-64 opacity-30" />
        <main className="flex flex-col gap-8 pt-8">
          <Shimmer className="h-8 w-2/3 opacity-40" />
          <Shimmer className="h-16 w-full opacity-30" />
          <Shimmer className="h-24 w-full opacity-20" />
        </main>
      </div>
    </div>
  );
}
