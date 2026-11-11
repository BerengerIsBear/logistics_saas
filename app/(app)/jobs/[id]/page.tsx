import { getAccessContext } from "@/lib/auth/access";
import JobDetailsPage from "@/features/jobs/pages/JobDetailsPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (!access.context) return null; // Parent layout handles missing role/login.
  return <JobDetailsPage params={params} canManageFinancials={access.context.role === "admin"} />;
}
