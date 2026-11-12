import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/access";
import EmployeesPage from "@/features/employees/pages/EmployeesPage";

export default async function Page() {
  const auth = await getAccessContext();
  if (!auth.context) return null;
  if (auth.context.role !== "admin") redirect(auth.context.role === "driver" ? "/driver-jobs" : "/jobs");
  return <EmployeesPage currentUserId={auth.context.userId} />;
}
