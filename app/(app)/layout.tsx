import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-neutral-950">
      <Sidebar />

      <main className="flex-1 overflow-y-auto bg-neutral-950">
        {children}
      </main>
    </div>
  );
}

