// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  const isJobsActive = pathname.startsWith("/jobs");
  const isDriverJobsActive = pathname.startsWith("/driver-jobs");
  const isCustomersActive = pathname.startsWith("/customers");

  const linkBase = "block rounded-md px-3 py-2 text-sm transition";
  const linkActive = "bg-neutral-900 text-white";
  const linkIdle = "text-neutral-700 hover:bg-neutral-100";

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white text-neutral-900">
      <div className="p-4 text-sm font-semibold">Logistics SaaS</div>

      <nav className="mt-2 space-y-1 px-2">
        <Link
          href="/jobs"
          className={[linkBase, isJobsActive ? linkActive : linkIdle].join(" ")}
        >
          Jobs
        </Link>

        <Link
          href="/customers"
          className={[linkBase, isCustomersActive ? linkActive : linkIdle].join(" ")}
        >
          Customers
        </Link>

        <Link
          href="/driver-jobs"
          className={[linkBase, isDriverJobsActive ? linkActive : linkIdle].join(" ")}
        >
          Driver Jobs
        </Link>

        <div className="mt-4 px-3 text-xs uppercase text-neutral-400">
          Coming next
        </div>

        <div className="px-3 py-2 text-sm text-neutral-400">Proof of Delivery</div>
        <div className="px-3 py-2 text-sm text-neutral-400">Invoices</div>
        <div className="px-3 py-2 text-sm text-neutral-400">Reports</div>
        <div className="px-3 py-2 text-sm text-neutral-400">Settings</div>
      </nav>
    </aside>
  );
}

