"use client";

import { useState, useTransition } from "react";
import { createRoomAction } from "@/lib/rooms/actions";

/** Opens a shared space for a title; playback stays on each member's own service. */
export function CreateRoomButton({ providerId, movieTitle }: { providerId: string; movieTitle: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(movieTitle);
  const [visibility, setVisibility] = useState<"followers" | "link">("followers");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="label self-start border border-[var(--line)] px-3 py-2 text-[var(--muted)] transition-colors hover:border-[var(--accent)]"
      >
        ウォッチルームを作る
      </button>
    );
  }

  return (
    <form
      action={() =>
        startTransition(async () => {
          const result = await createRoomAction(providerId, title, visibility);
          if (result?.error) setError(result.error);
        })
      }
      className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] p-4"
      aria-busy={pending}
    >
      <span className="label">Watch Room</span>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={60}
        className="border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {(["followers", "link"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setVisibility(option)}
            className="label border px-3 py-2 transition-colors"
            style={{
              borderColor: visibility === option ? "var(--accent)" : "var(--line)",
              color: visibility === option ? "var(--accent)" : "var(--muted)",
            }}
          >
            {option === "followers" ? "フォロワーまで" : "リンクを知る人まで"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="label border border-[var(--accent)] px-3 py-2 text-[var(--accent)]">
          作成する
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="label border border-[var(--line)] px-3 py-2 text-[var(--muted)]"
        >
          やめる
        </button>
      </div>
      {error ? (
        <span role="alert" className="font-mono text-xs" style={{ color: "var(--accent)" }}>
          {error}
        </span>
      ) : null}
    </form>
  );
}
