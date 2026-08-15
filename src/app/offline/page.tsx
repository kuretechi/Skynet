export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-6">
      <span className="label">Offline</span>
      <h1 className="display text-3xl">いまはオフラインです。</h1>
      <p className="text-sm text-[var(--muted)]">接続が戻ると、棚の続きから再開できます。</p>
    </main>
  );
}
