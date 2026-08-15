import { ROOM_EVENT, roomTopic, supabaseRealtimeConfig } from "@/lib/rooms/realtime";

/** Fire-and-forget: a dropped notification only costs one polling interval. */
export async function notifyRoomChanged(roomId: string): Promise<void> {
  const config = supabaseRealtimeConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: config.anonKey,
        authorization: `Bearer ${config.anonKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: roomTopic(roomId),
            event: ROOM_EVENT,
            payload: { at: Date.now() },
          },
        ],
      }),
    });
  } catch {
    // The client polls as a backstop, so a failed broadcast is not an error.
  }
}
