/**
 * Runs an async mapper over `items` with at most `concurrency` in flight,
 * preserving input order. Bounded on purpose: the app talks to a pooled
 * Postgres (Supabase PgBouncer) and to TMDB, and unbounded fan-out there is
 * how you exhaust connections and get rate limited.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
