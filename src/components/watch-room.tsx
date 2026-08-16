"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  endRoomAction,
  joinRoomAction,
  leaveRoomAction,
  postReactionAction,
  setRoomVisibilityAction,
  startRoomAction,
  syncPositionAction,
} from "@/lib/rooms/actions";
import { formatPosition, memberPositionMs, parsePosition } from "@/lib/rooms/clock";
import { useRoomState } from "@/lib/rooms/use-room-state";
import type { RoomState } from "@/lib/rooms/service";
import { RatingInput } from "@/components/rating-input";

const EMOJI = ["😳", "😂", "😭", "👏", "🔥", "🤯"] as const;
const MAX_COMMENT = 140;
const TICK_MS = 500;

export function WatchRoomView({
  initial,
  currentUserId,
  providerId,
  movieTitle,
  initialScore,
}: {
  initial: RoomState;
  currentUserId: string;
  providerId: string;
  movieTitle: string;
  initialScore: number | null;
}) {
  const { state, refresh } = useRoomState(initial.id, initial);
  const [now, setNow] = useState(() => Date.now());
  const [comment, setComment] = useState("");
  const [positionInput, setPositionInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const feedRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const isHost = state.hostId === currentUserId;
  const position = memberPositionMs(state.startedAt, state.offsetMs, now);

  // The server only sends reactions this member has already reached, so the
  // feed is whatever arrived. When something is still ahead, come back for it
  // the moment our own clock passes its timestamp.
  const revealed = state.reactions;
  const ahead = state.ahead;
  const nextAheadAtMs = state.nextAheadAtMs;

  useEffect(() => {
    if (nextAheadAtMs === null) return;
    const delay = Math.max(0, nextAheadAtMs - position) + 250;
    const timer = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timer);
    // `position` advances with the clock; re-arming on every tick would thrash,
    // so the timer is rebuilt only when the pending reaction changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAheadAtMs, refresh]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [revealed.length]);

  const run = (action: () => Promise<{ error?: string; ok?: boolean } | void>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) setError(result.error);
      await refresh();
    });
  };

  const send = (kind: "emoji" | "comment", body: string) => {
    if (!body.trim()) return;
    run(() => postReactionAction(state.id, kind, body));
  };

  const declarePosition = (form: FormData) => {
    const parsed = parsePosition(String(form.get("position") ?? ""));
    if (parsed === null) {
      setError("再生位置は 12:34 の形式で入力してください");
      return;
    }
    setPositionInput(null);
    run(() => (state.joined ? syncPositionAction(state.id, parsed) : joinRoomAction(state.id, parsed)));
  };

  return (
    <div className="flex flex-col gap-8" aria-busy={pending}>
      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex flex-col">
          <span className="label">{STATUS_LABEL[state.status] ?? state.status}</span>
          <span className="display text-2xl tabular-nums">
            {state.status === "live" ? formatPosition(position) : "--:--"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {isHost && state.status !== "ended" ? (
            state.status === "live" ? (
              <RoomButton onClick={() => run(() => endRoomAction(state.id))}>上映を終了</RoomButton>
            ) : (
              <RoomButton accent onClick={() => run(() => startRoomAction(state.id))}>
                上映を開始
              </RoomButton>
            )
          ) : null}
          {!state.joined && state.status !== "ended" ? (
            <RoomButton accent onClick={() => run(() => joinRoomAction(state.id, 0))}>
              参加する
            </RoomButton>
          ) : null}
          {state.joined && !isHost && state.status !== "ended" ? (
            <RoomButton onClick={() => run(() => leaveRoomAction(state.id))}>退出</RoomButton>
          ) : null}
          <InviteButton roomId={state.id} />
          {isHost ? (
            <RoomButton
              onClick={() =>
                run(() =>
                  setRoomVisibilityAction(state.id, state.visibility === "link" ? "followers" : "link"),
                )
              }
            >
              {state.visibility === "link" ? "リンクを知る人まで" : "フォロワーまで"}
            </RoomButton>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className="label">Members · {state.members.length}</span>
        <ul className="flex flex-wrap gap-2">
          {state.members.map((member) => (
            <li
              key={member.userId}
              className="label border border-[var(--line)] px-3 py-2 text-[var(--muted)]"
            >
              {member.name}
              {member.isHost ? " · HOST" : ""}
              {state.status === "live"
                ? ` · ${formatPosition(memberPositionMs(state.startedAt, member.offsetMs, now))}`
                : ""}
            </li>
          ))}
        </ul>
      </section>

      {state.status === "live" ? (
        <section className="flex flex-col gap-4">
          <span className="label">再生位置を合わせる</span>
          <p className="text-sm text-[var(--muted)]">
            映画は各自の配信サービスで再生してください。いま観ている位置を申告すると、その時刻に合わせて
            コメントが流れます。
          </p>
          <form action={declarePosition} className="flex flex-wrap items-center gap-2">
            <input
              name="position"
              inputMode="numeric"
              placeholder="12:34"
              value={positionInput ?? formatPosition(position)}
              onChange={(event) => setPositionInput(event.target.value)}
              className="w-28 border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm"
            />
            <RoomButton type="submit">この位置にする</RoomButton>
            <RoomButton
              onClick={() => {
                setPositionInput(null);
                run(() => syncPositionAction(state.id, 0));
              }}
            >
              いま最初から
            </RoomButton>
          </form>
        </section>
      ) : null}

      {state.status !== "scheduled" ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <span className="label">Reactions</span>
            {ahead > 0 ? (
              <span className="label text-[var(--muted)]">この先に {ahead} 件（ネタバレ防止）</span>
            ) : null}
          </div>

          <ul ref={feedRef} className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {revealed.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">まだリアクションがありません。</li>
            ) : (
              revealed.map((reaction) => (
                <li key={reaction.id} className="flex items-baseline gap-3">
                  <span className="font-mono text-[10px] text-[var(--muted)]">
                    {formatPosition(reaction.atMs)}
                  </span>
                  <span className="label text-[var(--muted)]">{reaction.userName}</span>
                  <span className={reaction.kind === "emoji" ? "text-xl leading-none" : "text-sm"}>
                    {reaction.body}
                  </span>
                </li>
              ))
            )}
          </ul>

          {state.status === "live" && state.joined ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => send("emoji", emoji)}
                    className="border border-[var(--line)] px-3 py-2 text-lg leading-none transition-colors hover:border-[var(--accent)]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <form
                action={() => {
                  send("comment", comment);
                  setComment("");
                }}
                className="flex gap-2"
              >
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={MAX_COMMENT}
                  placeholder="いまの一言"
                  className="min-w-0 flex-1 border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
                />
                <RoomButton type="submit">送信</RoomButton>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      {state.status === "ended" ? (
        <section className="flex flex-col gap-3 border border-[var(--accent)] bg-[var(--surface)] p-4">
          <span className="label" style={{ color: "var(--accent)" }}>
            上映終了 · 評価する
          </span>
          <p className="text-sm text-[var(--muted)]">
            {movieTitle} の評価は Cinema DNA と棚に反映されます。
          </p>
          <RatingInput providerId={providerId} initialScore={initialScore} />
          <Link href={`/movie/${providerId}`} className="label text-[var(--muted)] underline">
            レビューを書く
          </Link>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="font-mono text-xs" style={{ color: "var(--accent)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "開始待ち",
  live: "上映中",
  ended: "終了",
};

function RoomButton({
  children,
  onClick,
  type = "button",
  accent = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  accent?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="label border px-3 py-2 transition-colors"
      style={{
        borderColor: accent ? "var(--accent)" : "var(--line)",
        color: accent ? "var(--accent)" : "var(--muted)",
        background: accent ? "rgba(216,166,87,0.08)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function InviteButton({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <RoomButton
      onClick={() => {
        void navigator.clipboard?.writeText(`${window.location.origin}/room/${roomId}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "コピーしました" : "招待リンク"}
    </RoomButton>
  );
}
