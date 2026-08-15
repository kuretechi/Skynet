"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Home", caption: "今" },
  { href: "/discover", label: "Discover", caption: "次" },
  { href: "/shelf", label: "Shelf", caption: "過去" },
  { href: "/dna", label: "DNA", caption: "自分" },
  { href: "/community", label: "Community", caption: "他人" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[rgba(8,8,10,0.92)] backdrop-blur-md">
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className="flex flex-col items-center gap-1 px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <span
                  className="label"
                  style={{ color: active ? "var(--accent)" : "var(--muted)", letterSpacing: "0.14em" }}
                >
                  {tab.label}
                </span>
                <span className={`text-[10px] ${active ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
                  {tab.caption}
                </span>
                <span
                  aria-hidden
                  className="h-px w-6 transition-colors"
                  style={{ background: active ? "var(--accent)" : "transparent" }}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
