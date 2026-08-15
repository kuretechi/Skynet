"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState(
    mode === "login" ? signInAction : signUpAction,
    initialState,
  );

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-5">
      {mode === "signup" ? (
        <label className="flex flex-col gap-2">
          <span className="label">Name</span>
          <input
            name="name"
            required
            className="border-b border-[var(--line)] bg-transparent pb-2 outline-none focus:border-[var(--accent)]"
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-2">
        <span className="label">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="border-b border-[var(--line)] bg-transparent pb-2 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="border-b border-[var(--line)] bg-transparent pb-2 outline-none focus:border-[var(--accent)]"
        />
      </label>

      {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="label mt-2 border border-[var(--accent)] px-4 py-3 text-[var(--accent)] disabled:opacity-50"
      >
        {pending ? "…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
      </button>

      <p className="text-xs text-[var(--muted)]">
        {mode === "login" ? (
          <>
            アカウントがない場合は{" "}
            <Link href="/signup" className="text-[var(--accent)]">
              新規登録
            </Link>
          </>
        ) : (
          <>
            既にアカウントをお持ちの場合は{" "}
            <Link href="/login" className="text-[var(--accent)]">
              ログイン
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
