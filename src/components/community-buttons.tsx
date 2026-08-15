"use client";

import { useState, useTransition } from "react";
import { toggleFollowAction, toggleReviewLikeAction } from "@/lib/actions";

export function LikeButton({ reviewId, initialLiked, initialCount }: { reviewId: string; initialLiked: boolean; initialCount: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="label flex items-center gap-1"
      style={{ color: liked ? "var(--accent)" : "var(--muted)" }}
      onClick={() => {
        setLiked(!liked);
        setCount((c) => c + (liked ? -1 : 1));
        startTransition(async () => {
          await toggleReviewLikeAction(reviewId);
        });
      }}
    >
      {liked ? "♥" : "♡"} {count}
    </button>
  );
}

export function FollowButton({ userId, initialFollowing }: { userId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="label border px-3 py-1.5"
      style={{
        borderColor: following ? "var(--accent)" : "var(--line)",
        color: following ? "var(--accent)" : "var(--foreground)",
      }}
      onClick={() => {
        setFollowing(!following);
        startTransition(async () => {
          await toggleFollowAction(userId);
        });
      }}
    >
      {following ? "FOLLOWING" : "FOLLOW"}
    </button>
  );
}

export function SpoilerText({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  if (revealed) return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="w-full border border-dashed border-[var(--line)] bg-[var(--surface-2)] px-3 py-4 text-left text-xs text-[var(--muted)]"
    >
      ネタバレを含むレビューです。タップで表示。
    </button>
  );
}
