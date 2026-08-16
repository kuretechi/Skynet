"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { postReviewAction, type ActionState, type ReviewCard } from "@/lib/actions";

export function ReviewForm({
  providerId,
  initialText,
  initialSpoiler,
  onPosted,
}: {
  providerId: string;
  initialText?: string;
  initialSpoiler?: boolean;
  onPosted?: (review: ReviewCard) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    const result = await postReviewAction({}, formData);
    setPending(false);
    setState({ ok: result.ok, error: result.error });
    if (!result.ok) return;
    if (result.review) onPosted?.(result.review);
    // Keeps the rest of the page (community feed, counters) in step.
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] p-4">
      <input type="hidden" name="providerId" value={providerId} />
      <label className="label" htmlFor="review-text">
        Write Review
      </label>
      <textarea
        id="review-text"
        name="text"
        rows={4}
        defaultValue={initialText}
        placeholder="この映画が自分に何を残したか。"
        className="resize-none border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm outline-none focus:border-[var(--accent)]"
      />
      <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <input type="checkbox" name="spoiler" defaultChecked={initialSpoiler} className="accent-[var(--accent)]" />
        ネタバレを含む
      </label>
      {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-[var(--accent)]">投稿しました</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="label self-start border border-[var(--accent)] px-4 py-2 text-[var(--accent)] disabled:opacity-50"
      >
        {pending ? "POSTING…" : "POST"}
      </button>
    </form>
  );
}
