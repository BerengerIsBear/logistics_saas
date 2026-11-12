import { getAccessContext } from "@/lib/auth/access";
import ReportsPage from "@/features/reports/pages/ReportsPage";

export default async function Page() {
  const access = await getAccessContext();
  if (!access.context) return null;
  return <ReportsPage isAdmin={access.context.role === "admin"} />;
}
