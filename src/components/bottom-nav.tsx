"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Film frame — what you are watching now. */
const HomeIcon = (
  <>
    <rect x="3" y="5" width="18" height="14" rx="1.5" {...stroke} />
    <path d="M7 5v14M17 5v14M3 12h4M17 12h4" {...stroke} />
  </>
);

/** Compass — what to watch next. */
const DiscoverIcon = (
  <>
    <circle cx="12" cy="12" r="8.5" {...stroke} />
    <path d="m15 9-2.2 4.8L8 16l2.2-4.8L15 9Z" {...stroke} />
  </>
);

/** VHS spines on a shelf — what you have watched. */
const ShelfIcon = (
  <>
    <path d="M5 6h3v13H5zM10.5 6h3v13h-3zM16 7.5l3 .8-3 11.2-3-.8z" {...stroke} />
    <path d="M3 20.5h18" {...stroke} />
  </>
);

/** The crystal — yourself. */
const DnaIcon = (
  <>
    <path d="M12 3.5 19 8v8l-7 4.5L5 16V8z" {...stroke} />
    <path d="M12 8.5 15.5 11v3.4L12 16.5 8.5 14.4V11z" {...stroke} />
  </>
);

/** Account and display preferences. */
const ProfileIcon = (
  <>
    <circle cx="12" cy="8.5" r="3.5" {...stroke} />
    <path d="M5 20c.7-4 3.2-6 7-6s6.3 2 7 6" {...stroke} />
  </>
);

const TABS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/discover", label: "Discover", icon: DiscoverIcon },
  { href: "/shelf", label: "Shelf", icon: ShelfIcon },
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/dna", label: "DNA", icon: DnaIcon },
  { href: "/profile", label: "Profile", icon: ProfileIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--nav-background)] backdrop-blur-md">
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className={`flex-1 ${tab.href === "/home" ? "home-tab" : ""}`}>
              <Link
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className="nav-link flex flex-col items-center gap-1 px-1 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] transition-all"
                style={{ color: active ? "var(--accent)" : "var(--muted)" }}
              >
                <span className="nav-icon flex items-center justify-center">
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden focusable="false">
                  {tab.icon}
                </svg>
                </span>
                <span className="text-[9px] tracking-[0.14em] uppercase">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
