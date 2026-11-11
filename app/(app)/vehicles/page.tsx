// app/(app)/vehicles/page.tsx
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/access";
import VehiclesPage from "@/features/vehicles/pages/VehiclesPage";

export default async function Page() {
  const access = await getAccessContext();
  if (!access.context) return null;
  if (access.context.role === "driver") redirect("/driver-jobs");
  return <VehiclesPage canManage={access.context.role === "admin"} />;
}
