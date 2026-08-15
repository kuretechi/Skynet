"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeClient } from "@supabase/realtime-js";
import { ROOM_EVENT, roomTopic, supabaseRealtimeConfig } from "@/lib/rooms/realtime";
import type { RoomState } from "@/lib/rooms/service";

const REALTIME_POLL_MS = 20_000;
const FALLBACK_POLL_MS = 3_000;

/**
 * Keeps the room in sync with a Supabase Realtime broadcast when the project is
 * configured, and with plain polling when it is not (local SQLite dev). The
 * broadcast only says "something changed"; the state itself always comes from
 * our authenticated API.
 */
export function useRoomState(roomId: string, initial: RoomState) {
  const [state, setState] = useState(initial);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
      if (response.ok) setState((await response.json()) as RoomState);
    } catch {
      // Transient network errors resolve on the next tick.
    } finally {
      inFlight.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    const config = supabaseRealtimeConfig();
    const interval = window.setInterval(refresh, config ? REALTIME_POLL_MS : FALLBACK_POLL_MS);
    if (!config) return () => window.clearInterval(interval);

    const client = new RealtimeClient(`${config.url}/realtime/v1`, {
      params: { apikey: config.anonKey },
    });
    const channel = client.channel(roomTopic(roomId));
    channel.on("broadcast", { event: ROOM_EVENT }, () => void refresh()).subscribe();

    return () => {
      window.clearInterval(interval);
      void channel.unsubscribe();
      client.disconnect();
    };
  }, [refresh, roomId]);

  return { state, refresh, setState };
}
