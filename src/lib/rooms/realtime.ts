/**
 * Realtime here is a doorbell, not a data channel: the server broadcasts "this
 * room changed" and every client re-reads the authoritative state from our own
 * API. Nothing sensitive rides on the channel and a forged broadcast can only
 * make a client refetch. Without Supabase credentials the client falls back to
 * polling, which is what local SQLite development uses.
 */

export const ROOM_EVENT = "changed";

export const roomTopic = (roomId: string) => `room:${roomId}`;

export const supabaseRealtimeConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ""), anonKey };
};
