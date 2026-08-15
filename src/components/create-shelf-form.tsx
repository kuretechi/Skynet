"use client";

import { useActionState, useEffect, useState } from "react";
import { createShelfAction, type ActionState } from "@/lib/actions";

const MOTIFS = [
  { id: "vhs", label: "VHS" },
  { id: "cassette", label: "CASSETTE" },
  { id: "film_roll", label: "FILM ROLL" },
  { id: "archive_box", label: "ARCHIVE" },
];

const initialState: ActionState = {};

export function CreateShelfForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createShelfAction, initialState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="label border border-[var(--line)] px-3 py-2">
        + NEW SHELF
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] p-4">
      <label className="flex flex-col gap-2">
        <span className="label">Shelf Name</span>
        <input
          name="name"
          required
          placeholder="人生の10本 / 雨の日に観たい"
          className="border-b border-[var(--line)] bg-transparent pb-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="label mb-2">Motif</legend>
        {MOTIFS.map((motif, index) => (
          <label key={motif.id} className="label cursor-pointer border border-[var(--line)] px-3 py-2">
            <input type="radio" name="motif" value={motif.id} defaultChecked={index === 0} className="mr-2 accent-[var(--accent)]" />
            {motif.label}
          </label>
        ))}
      </fieldset>
      {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="label border border-[var(--accent)] px-4 py-2 text-[var(--accent)]">
          {pending ? "…" : "CREATE"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="label border border-[var(--line)] px-4 py-2">
          CANCEL
        </button>
      </div>
    </form>
  );
}
