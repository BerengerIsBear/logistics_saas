import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/access";
import AdminAuditPage from "@/features/audit/pages/AdminAuditPage";

export default async function Page() {
  const access = await getAccessContext();
  if (!access.context) return null; // Parent layout handles unauthorised accounts.
  if (access.context.role !== "admin") redirect(access.context.role === "driver" ? "/driver-jobs" : "/jobs");
  return <AdminAuditPage />;
}
