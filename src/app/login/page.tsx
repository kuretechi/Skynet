import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardedAt ? "/home" : "/onboarding");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-6 py-14">
      <div className="flex flex-col gap-3">
        <Logo size={30} className="mb-3" />
        <span className="label">Sign In</span>
        <h1 className="display text-3xl">おかえりなさい。</h1>
      </div>
      <AuthForm mode="login" />
    </main>
  );
}
