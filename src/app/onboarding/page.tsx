import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardedAt) redirect("/home");

  const ratedCount = await prisma.rating.count({ where: { userId: user.id } });

  return (
    <main className="mx-auto max-w-3xl px-6">
      <OnboardingFlow initialRatedCount={ratedCount} name={user.name} />
    </main>
  );
}
