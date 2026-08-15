import { Shimmer } from "@/components/skeletons";

/** Shown the instant a tab is tapped, while the page streams in. */
export default function Loading() {
  return (
    <main className="flex flex-col gap-10 pt-10">
      <header>
        <span className="label">Cinema DNA</span>
        <Shimmer className="mt-3 h-7 w-56 opacity-40" />
      </header>
      <div className="flex flex-col gap-4">
        <Shimmer className="h-4 w-32 opacity-40" />
        <Shimmer className="h-40 w-full opacity-30" />
        <Shimmer className="h-40 w-full opacity-20" />
      </div>
    </main>
  );
}
