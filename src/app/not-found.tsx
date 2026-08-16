import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-6">
      <span className="label">Not found</span>
      <h1 className="display text-3xl">このページは見つかりませんでした。</h1>
      <p className="text-sm text-[var(--muted)]">URLが変わったか、公開されていない部屋かもしれません。</p>
      <div className="mt-4 flex flex-col gap-3">
        <Link href="/" className="label border border-[var(--accent)] px-4 py-4 text-center text-[var(--accent)]">
          HOME
        </Link>
        <Link href="/demo" className="label border border-[var(--line)] px-4 py-4 text-center">
          ログイン不要デモ
        </Link>
      </div>
    </main>
  );
}
