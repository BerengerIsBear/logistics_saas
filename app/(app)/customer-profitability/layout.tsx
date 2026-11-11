import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/access";

export default async function Layout({ children }: { children: ReactNode }) {
  const access = await getAccessContext();
  if (!access.context) return null; // Parent layout handles missing profile/login.
  if (access.context.role !== "admin") {
    redirect(access.context.role === "driver" ? "/driver-jobs" : "/jobs");
  }
  return children;
}
