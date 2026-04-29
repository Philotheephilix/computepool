import { ComputePoolDemo } from "@/components/ComputePoolDemo";
import { JobDetailClient } from "@/components/jobs/JobDetailClient";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "demo") {
    return <ComputePoolDemo />;
  }

  return <JobDetailClient id={id} />;
}
