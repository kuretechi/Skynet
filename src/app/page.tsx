import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CrystalDrift } from "@/components/crystal-drift";
import { Logo } from "@/components/logo";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardedAt ? "/home" : "/onboarding");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-between px-6 py-14">
      <div className="flex flex-col gap-10">
        <Logo size={40} />
        <h1 className="display text-4xl leading-[1.25]">
          映画を探す場所ではなく、
          <br />
          あなたの映画人生をつくる場所。
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-[var(--muted)]">
          観た映画を棚に収め、好みを Cinema DNA として可視化し、まだ観ていない一本に「あなた専用のスコア」をつける。
        </p>
        <div className="flex justify-center py-4">
          <CrystalDrift size={280} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/signup" className="label border border-[var(--accent)] px-4 py-4 text-center text-[var(--accent)]">
          START YOUR ARCHIVE
        </Link>
        <Link href="/login" className="label border border-[var(--line)] px-4 py-4 text-center">
          SIGN IN
        </Link>
        <Link href="/demo" className="label px-4 py-2 text-center text-[var(--muted)]">
          ログインせずに CineType を試す
        </Link>
      </div>
    </main>
  );
}
