// app/(app)/drivers/page.tsx
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/access";
import DriversPage from "@/features/drivers/pages/DriversPage";

export default async function Page() {
  const access = await getAccessContext();
  if (!access.context) return null; // Parent layout handles login / missing role.
  if (access.context.role === "driver") redirect("/driver-jobs");
  return <DriversPage canManage={access.context.role === "admin"} />;
}
