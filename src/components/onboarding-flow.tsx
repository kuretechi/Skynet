"use client";

import { useState, useTransition } from "react";
import { completeOnboardingAction } from "@/lib/actions";
import { ONBOARDING_TARGET_RATINGS } from "@/lib/config";
import { MovieSearch } from "./movie-search";

type Step = "welcome" | "rate" | "analyzing";

export function OnboardingFlow({ initialRatedCount, name }: { initialRatedCount: number; name: string }) {
  const [step, setStep] = useState<Step>(initialRatedCount > 0 ? "rate" : "welcome");
  const [rated, setRated] = useState<string[]>([]);
  // Rating revalidates this route, so initialRatedCount already grows with each
  // rating; the baseline is frozen at mount to avoid counting them twice.
  const [baseline] = useState(initialRatedCount);
  const [, startTransition] = useTransition();

  const count = Math.max(initialRatedCount, baseline + rated.length);
  const remaining = Math.max(0, ONBOARDING_TARGET_RATINGS - count);

  const finish = () => {
    setStep("analyzing");
    startTransition(async () => {
      await completeOnboardingAction();
    });
  };

  if (step === "welcome") {
    return (
      <div className="reveal flex min-h-dvh flex-col justify-between py-14">
        <div className="flex flex-col gap-6">
          <span className="label">Welcome</span>
          <h1 className="display text-3xl leading-relaxed">
            {name} さん、
            <br />
            好きな映画を {ONBOARDING_TARGET_RATINGS} 本評価すると、
            <br />
            あなたの CineType が分かります。
          </h1>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            評価は 0.5 〜 5.0。総合評価だけで完了できます。観た記録は自動的に棚に収められます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep("rate")}
          className="label border border-[var(--accent)] px-4 py-4 text-[var(--accent)]"
        >
          START RATING
        </button>
      </div>
    );
  }

  if (step === "analyzing") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
        <span className="label">Analyzing…</span>
        <p className="display animate-pulse text-2xl">Cinema DNA を生成しています</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-10">
      <div className="flex items-baseline justify-between">
        <span className="label">Rate {ONBOARDING_TARGET_RATINGS} Movies</span>
        <span className="font-mono text-xs text-[var(--muted)]">
          {count} / {ONBOARDING_TARGET_RATINGS}
        </span>
      </div>
      <div className="h-px w-full bg-[var(--line)]">
        <div
          className="h-px bg-[var(--accent)] transition-all"
          style={{ width: `${Math.min(100, (count / ONBOARDING_TARGET_RATINGS) * 100)}%` }}
        />
      </div>

      <MovieSearch
        mode="rate"
        onRated={(providerId) => setRated((prev) => (prev.includes(providerId) ? prev : [...prev, providerId]))}
        placeholder="観たことのある映画を検索"
      />

      <button
        type="button"
        onClick={finish}
        disabled={count === 0}
        className="label sticky bottom-6 border border-[var(--accent)] bg-[var(--background)] px-4 py-4 text-[var(--accent)] disabled:opacity-40"
      >
        {remaining > 0 ? `あと ${remaining} 本 — 今すぐ生成する` : "CREATE MY CINEMA DNA"}
      </button>
    </div>
  );
}
