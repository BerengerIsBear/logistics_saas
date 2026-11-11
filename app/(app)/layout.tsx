// app/(app)/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { getAccessContext } from "@/lib/auth/access";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const access = await getAccessContext();
  if (!access.context && access.status === 401) redirect("/login");

  // No role configured? Show a clear message rather than granting access.
  if (!access.context) {
    return (
      <div className="min-h-screen bg-white text-neutral-900">
        <Topbar />
        <p className="p-6">Access denied. Ask your administrator to assign your company and role.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-950">
      <Sidebar role={access.context.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-neutral-950">{children}</main>
      </div>
    </div>
  );
}
