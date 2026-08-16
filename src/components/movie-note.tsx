"use client";

import { useState, useTransition } from "react";
import { saveMovieNoteAction } from "@/lib/actions";

const LIMIT = 2000;

/** Private memo for one movie: never published, unlike a review. */
export function MovieNote({ providerId, initial }: { providerId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = text.trim() !== saved;

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveMovieNoteAction(providerId, text);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaved(result.text ?? "");
      setText(result.text ?? "");
    });
  };

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        maxLength={LIMIT}
        rows={4}
        placeholder="観た日のこと、刺さった場面、次に観たい理由。自分だけのメモ。"
        className="w-full resize-y border border-[var(--line)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="label border px-3 py-2 transition-colors disabled:opacity-40"
          style={{ borderColor: dirty ? "var(--accent)" : "var(--line)", color: dirty ? "var(--accent)" : "var(--muted)" }}
        >
          {pending ? "SAVING…" : "SAVE NOTE"}
        </button>
        <span className="font-mono text-[10px] text-[var(--muted)]">
          {text.length}/{LIMIT}
        </span>
        {error ? (
          <span role="alert" className="font-mono text-xs text-[var(--accent)]">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
