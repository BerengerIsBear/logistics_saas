import JobDetailsPage from "@/features/jobs/pages/JobDetailsPage";

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <JobDetailsPage params={params} />;
}

