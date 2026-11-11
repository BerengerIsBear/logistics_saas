// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/access";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const isJobsActive = pathname.startsWith("/jobs");
  const isDriverJobsActive = pathname.startsWith("/driver-jobs");
  const isCustomersActive = pathname.startsWith("/customers");
  const isDriversActive = pathname.startsWith("/drivers");
  const isVehiclesActive = pathname.startsWith("/vehicles");
  const isProfitabilityActive = pathname.startsWith("/customer-profitability");
  const isProfitRiskActive = pathname.startsWith("/profit-risk");
  const isDriverPerformanceActive = pathname.startsWith("/driver-performance");
  const isSlaPerformanceActive = pathname.startsWith("/sla-performance");

  const linkBase = "block rounded-md px-3 py-2 text-sm transition";
  const linkActive = "bg-neutral-900 text-white";
  const linkIdle = "text-neutral-700 hover:bg-neutral-100";

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white text-neutral-900">
      <div className="p-4 text-sm font-semibold">Logistics SaaS</div>

      <nav className="mt-2 space-y-1 px-2">
        {role !== "driver" ? (
          <>
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
              href="/drivers"
              className={[linkBase, isDriversActive ? linkActive : linkIdle].join(" ")}
            >
              Drivers
            </Link>
            <Link
              href="/vehicles"
              className={[linkBase, isVehiclesActive ? linkActive : linkIdle].join(" ")}
            >
              Vehicles
            </Link>
            <Link
              href="/driver-performance"
              className={[linkBase, isDriverPerformanceActive ? linkActive : linkIdle].join(" ")}
            >
              Driver Performance
            </Link>
            <Link
              href="/sla-performance"
              className={[linkBase, isSlaPerformanceActive ? linkActive : linkIdle].join(" ")}
            >
              SLA Performance
            </Link>
          </>
        ) : (
          <Link
            href="/driver-jobs"
            className={[linkBase, isDriverJobsActive ? linkActive : linkIdle].join(" ")}
          >
            My Deliveries
          </Link>
        )}

        {role === "admin" && (
          <>
          <Link
            href="/profit-risk"
            className={[linkBase, isProfitRiskActive ? linkActive : linkIdle].join(" ")}
          >
            Profit & Risk
          </Link>
          <Link
            href="/customer-profitability"
            className={[linkBase, isProfitabilityActive ? linkActive : linkIdle].join(" ")}
          >
            Customer Profitability
          </Link>
          </>
        )}

        {role !== "driver" && (
          <>
            <div className="mt-4 px-3 text-xs uppercase text-neutral-400">
              Coming next
            </div>
            <div className="px-3 py-2 text-sm text-neutral-400">Invoices</div>
            <div className="px-3 py-2 text-sm text-neutral-400">Reports</div>
            <div className="px-3 py-2 text-sm text-neutral-400">Settings</div>
          </>
        )}
      </nav>
    </aside>
  );
}

