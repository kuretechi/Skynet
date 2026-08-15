/**
 * A watch room has no player: every member presses play on their own service.
 * The room only agrees on a clock. `offsetMs` is how far behind the room a
 * member is, so their position inside the film is
 *
 *   position = (now - startedAt) - offsetMs
 *
 * Someone who joins late and says "I'm at 32:10" gets
 * `offsetMs = elapsed - 32:10`, and a reaction they post is stamped with their
 * own position, not the room's — which is what keeps the feed spoiler-safe.
 */

export const roomElapsedMs = (startedAt: Date | string | null, now = Date.now()) =>
  startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : 0;

export const memberPositionMs = (
  startedAt: Date | string | null,
  offsetMs: number,
  now = Date.now(),
) => Math.max(0, roomElapsedMs(startedAt, now) - offsetMs);

/** Offset that puts a member at `positionMs` right now. */
export const offsetForPosition = (
  startedAt: Date | string | null,
  positionMs: number,
  now = Date.now(),
) => roomElapsedMs(startedAt, now) - positionMs;

export function formatPosition(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Accepts `12:34`, `1:02:03` or plain minutes; returns milliseconds. */
export function parsePosition(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0] * 60_000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}
