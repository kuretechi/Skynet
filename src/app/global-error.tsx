"use client";

/** Last resort: the root layout itself failed, so this renders its own document. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body
        style={{
          background: "#08080a",
          color: "#f4f1ea",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100dvh",
          flexDirection: "column",
          justifyContent: "center",
          gap: 16,
          padding: "0 24px",
          margin: 0,
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>うまく読み込めませんでした。</h1>
        <p style={{ fontSize: 14, opacity: 0.6, margin: 0 }}>少し待ってからもう一度お試しください。</p>
        <button
          type="button"
          onClick={reset}
          style={{ alignSelf: "flex-start", background: "none", border: "1px solid #d8a657", color: "#d8a657", padding: "14px 18px" }}
        >
          RETRY
        </button>
      </body>
    </html>
  );
}
