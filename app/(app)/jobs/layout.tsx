// app/(app)/jobs/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/access";

export default async function Layout({ children }: { children: ReactNode }) {
  const access = await getAccessContext();
  if (!access.context) return null; // Parent layout displays missing-role / login state.
  if (access.context.role === "driver") redirect("/driver-jobs");
  return children;
}
