"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const isJobsActive = pathname.startsWith("/jobs");

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white text-neutral-900">
      <div className="p-4 text-sm font-semibold">
        Logistics SaaS
      </div>

      <nav className="mt-2 space-y-1 px-2">
        <Link
          href="/jobs"
          className={[
            "block rounded-md px-3 py-2 text-sm transition",
            isJobsActive
              ? "bg-neutral-900 text-white"
              : "text-neutral-700 hover:bg-neutral-100",
          ].join(" ")}
        >
          Jobs
        </Link>

        <div className="mt-4 px-3 text-xs uppercase text-neutral-400">
          Coming next
        </div>

        <div className="px-3 py-2 text-sm text-neutral-400">
          Proof of Delivery
        </div>

        <div className="px-3 py-2 text-sm text-neutral-400">
          Invoices
        </div>
      </nav>
    </aside>
  );
}
