import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegistrar } from "@/components/sw-register";
import { getCurrentUser } from "@/lib/auth";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="min-h-dvh pb-24">
      <ServiceWorkerRegistrar />
      <div className="mx-auto max-w-3xl px-5">{children}</div>
      <BottomNav />
    </div>
  );
}
