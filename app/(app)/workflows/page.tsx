import { getAccessContext } from "@/lib/auth/access";
import WorkflowsPage from "@/features/workflows/pages/WorkflowsPage";

export default async function Page() {
  const access = await getAccessContext();
  if (!access.context) return null;
  return <WorkflowsPage canCreate={access.context.role === "admin"} />;
}
