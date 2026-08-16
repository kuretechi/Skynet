"use client";

import Link from "next/link";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-6">
      <span className="label">Error</span>
      <h1 className="display text-3xl">うまく読み込めませんでした。</h1>
      <p className="text-sm text-[var(--muted)]">
        混み合っているのかもしれません。少し待ってからもう一度お試しください。
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <button type="button" onClick={reset} className="label border border-[var(--accent)] px-4 py-4 text-[var(--accent)]">
          RETRY
        </button>
        <Link href="/" className="label border border-[var(--line)] px-4 py-4 text-center">
          HOME
        </Link>
      </div>
    </main>
  );
}
