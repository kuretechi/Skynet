/**
 * Small process-wide caches for rows that are themselves caches of immutable or
 * provider-owned data. React's `cache()` only dedupes within one render, so
 * every navigation still paid a round trip for vectors that can never change.
 */

/** Bounded map that evicts the least recently used entry. */
export class LruMap<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(private readonly limit: number) {}

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }
}

type Expiring<V> = { value: V; expiresAt: number };

/** Time-boxed memo for values that are shared by every user of an instance. */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, Expiring<Promise<V>>>();

  constructor(private readonly ttlMs: number) {}

  async get(key: K, load: () => Promise<V>): Promise<V> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value = load();
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    try {
      return await value;
    } catch (error) {
      this.entries.delete(key);
      throw error;
    }
  }
}
