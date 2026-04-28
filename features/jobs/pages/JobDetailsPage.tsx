// features/jobs/pages/JobDetailsPage.tsx

"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

type Job = {
  id: string;
  job_number: string;
  customer: string | null;
  pickup: string;
  dropoff: string;
  driver: string | null;
  status: JobStatus;
  notes: string | null;
  scheduled_date: string | null;
  window_start: string | null;
  window_end: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  assigned_at: string | null;
  in_transit_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string | null;
  customers?: { name: string } | null;
  drivers?: { name: string } | null;
  vehicles?: { plate_no: string } | null;
};

type Driver = {
  id: string;
  name: string;
};

type Vehicle = {
  id: string;
  plate_no: string;
  type?: string | null;
};

type PodFile = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
  signedUrl: string | null;
};

type ActivityItem = {
  id: string;
  company_id: string;
  job_id: string | null;
  action: string;
  actor_user_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export default function JobDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const jobNumber = decodeURIComponent(id);

  const [job, setJob] = useState<Job | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [podFiles, setPodFiles] = useState<PodFile[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);

  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [progressing, setProgressing] = useState(false);
  const [uploadingPod, setUploadingPod] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadJob() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobNumber)}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load job");
      }

      const loadedJob = json.job as Job;

      setJob(loadedJob);
      setSelectedDriverId(loadedJob.driver_id ?? "");
      setSelectedVehicleId(loadedJob.vehicle_id ?? "");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(err.message);
      } else {
        setMsg("Failed to load job");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    try {
      const [driversRes, vehiclesRes] = await Promise.all([
        fetch("/api/drivers", { cache: "no-store" }),
        fetch("/api/vehicles", { cache: "no-store" }),
      ]);

      const driversJson = await driversRes.json();
      const vehiclesJson = await vehiclesRes.json();

      if (driversRes.ok) {
        setDrivers(driversJson.drivers ?? []);
      }

      if (vehiclesRes.ok) {
        setVehicles(vehiclesJson.vehicles ?? []);
      }
    } catch {
      // Keep page usable even if dropdown data fails.
    }
  }

  async function loadPodFiles() {
    try {
      const res = await fetch(
        `/api/pod?jobId=${encodeURIComponent(jobNumber)}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load POD files");
      }

      setPodFiles(json.items ?? []);
    } catch {
      setPodFiles([]);
    }
  }

  async function loadActivity() {
    try {
      const res = await fetch(
        `/api/activity?jobId=${encodeURIComponent(jobNumber)}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load activity");
      }

      setActivityItems(json.items ?? []);
    } catch {
      setActivityItems([]);
    }
  }

  useEffect(() => {
    loadJob();
    loadOptions();
    loadPodFiles();
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobNumber]);

  async function assignJob() {
    if (!selectedDriverId || !selectedVehicleId) {
      setMsg("Select driver and vehicle first.");
      return;
    }

    setAssigning(true);
    setMsg("");

    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobNumber)}/assign`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            driverId: selectedDriverId,
            vehicleId: selectedVehicleId,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to assign job");
      }

      setJob(json.job);
      setMsg("Job assigned successfully.");

      await loadJob();
      await loadActivity();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(err.message);
      } else {
        setMsg("Failed to assign job");
      }
    } finally {
      setAssigning(false);
    }
  }

  async function progressJob(action: "start" | "complete") {
    setProgressing(true);
    setMsg("");

    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobNumber)}/progress`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update job progress");
      }

      setMsg(action === "start" ? "Job started." : "Job completed.");

      await loadJob();
      await loadActivity();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(err.message);
      } else {
        setMsg("Failed to update job progress");
      }
    } finally {
      setProgressing(false);
    }
  }

  async function uploadPod(file: File | null) {
    if (!file) {
      return;
    }

    setUploadingPod(true);
    setMsg("");

    try {
      const formData = new FormData();
      formData.append("jobId", jobNumber);
      formData.append("file", file);

      const res = await fetch("/api/pod", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to upload POD");
      }

      setMsg("POD uploaded successfully.");

      await loadPodFiles();
      await loadActivity();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(err.message);
      } else {
        setMsg("Failed to upload POD");
      }
    } finally {
      setUploadingPod(false);
    }
  }

  async function deletePod(podId: string) {
    setMsg("");

    try {
      const res = await fetch("/api/pod", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ podId }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete POD");
      }

      setMsg("POD deleted.");

      await loadPodFiles();
      await loadActivity();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(err.message);
      } else {
        setMsg("Failed to delete POD");
      }
    }
  }

  const canAssign = job?.status === "pending" || job?.status === "assigned";
  const canStart = job?.status === "assigned";
  const canComplete = job?.status === "in_transit";

  if (loading && !job) {
    return (
      <PageShell>
        <PageHeader
          title="Job Details"
          subtitle="Loading job..."
          action={
            <Link href="/jobs">
              <Button variant="outline">Back</Button>
            </Link>
          }
        />

        <Card>
          <CardContent>
            <div className="text-sm text-neutral-600">Loading...</div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!job) {
    return (
      <PageShell>
        <PageHeader
          title="Job Details"
          subtitle="Job could not be loaded."
          action={
            <Link href="/jobs">
              <Button variant="outline">Back</Button>
            </Link>
          }
        />

        <Card>
          <CardContent>
            <div className="text-sm text-red-600">
              {msg || "Job not found."}
            </div>

            <div className="mt-4">
              <Button type="button" variant="outline" onClick={loadJob}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={job.job_number}
        subtitle="View assignment, workflow status, proof of delivery, and activity history."
        action={
          <Link href="/jobs">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />

      {msg ? (
        <div className="mb-4 rounded-lg border border-white/10 bg-white px-4 py-3 text-sm text-neutral-800">
          {msg}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-900">
                  Job Information
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  Main operational details.
                </div>
              </div>

              <StatusBadge status={job.status} />
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Customer"
                value={job.customers?.name ?? job.customer ?? "-"}
              />
              <Detail label="Scheduled date" value={job.scheduled_date ?? "-"} />
              <Detail label="Pickup" value={job.pickup} />
              <Detail label="Drop-off" value={job.dropoff} />
              <Detail label="Window start" value={job.window_start ?? "-"} />
              <Detail label="Window end" value={job.window_end ?? "-"} />
              <Detail
                label="Driver"
                value={job.drivers?.name ?? job.driver ?? "-"}
              />
              <Detail label="Vehicle" value={job.vehicles?.plate_no ?? "-"} />
            </div>

            <div className="mt-4">
              <Detail label="Notes" value={job.notes ?? "-"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-neutral-900">
              Workflow
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Server-enforced job progress.
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              <Button
                type="button"
                variant="primary"
                disabled={!canStart || progressing}
                onClick={() => progressJob("start")}
              >
                {progressing ? "Updating..." : "Start Job"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!canComplete || progressing}
                onClick={() => progressJob("complete")}
              >
                {progressing ? "Updating..." : "Complete Job"}
              </Button>

              <div className="pt-2 text-xs text-neutral-500">
                Valid flow: Pending → Assigned → In Transit → Delivered
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-neutral-900">
              Assignment
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Assign driver and vehicle before starting the job.
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-xs text-neutral-500">Driver</div>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  disabled={!canAssign}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="">Select driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-neutral-500">Vehicle</div>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  disabled={!canAssign}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_no}
                      {vehicle.type ? ` · ${vehicle.type}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                variant="primary"
                disabled={!canAssign || assigning}
                onClick={assignJob}
              >
                {assigning ? "Assigning..." : "Assign Job"}
              </Button>

              {!canAssign ? (
                <div className="text-xs text-neutral-500">
                  Assignment is locked after the job has started.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-neutral-900">
              Proof of Delivery
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Upload and view delivery proof.
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <input
                type="file"
                disabled={uploadingPod}
                onChange={(e) => uploadPod(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900"
              />

              {uploadingPod ? (
                <div className="text-sm text-neutral-500">Uploading...</div>
              ) : null}

              <div className="space-y-2">
                {podFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-neutral-900">
                        {file.file_name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {file.created_at
                          ? new Date(file.created_at).toLocaleString()
                          : "-"}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {file.signedUrl ? (
                        <a
                          href={file.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-neutral-900 hover:underline"
                        >
                          View
                        </a>
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => deletePod(file.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}

                {podFiles.length === 0 ? (
                  <div className="text-sm text-neutral-500">
                    No POD uploaded yet.
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-neutral-900">
              Operational Timeline
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Key timestamps for accountability.
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Created" value={formatDateTime(job.created_at)} />
              <Detail label="Assigned" value={formatDateTime(job.assigned_at)} />
              <Detail
                label="In transit"
                value={formatDateTime(job.in_transit_at)}
              />
              <Detail label="Delivered" value={formatDateTime(job.delivered_at)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-900">
                  Activity Timeline
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  Audit history for this job.
                </div>
              </div>

              <Button type="button" variant="outline" onClick={loadActivity}>
                Refresh
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {activityItems.length === 0 ? (
              <div className="text-sm text-neutral-500">
                No activity recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {activityItems.map((item) => (
                  <ActivityCard
                    key={item.id}
                    item={item}
                    drivers={drivers}
                    vehicles={vehicles}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium text-neutral-900">
        {value}
      </div>
    </div>
  );
}

function ActivityCard({
  item,
  drivers,
  vehicles,
}: {
  item: ActivityItem;
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const title = formatActivityAction(item.action);
  const description = formatActivityDescription(item, drivers, vehicles);
  const chips = getActivityChips(item, drivers, vehicles);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <div className="mt-1 text-sm text-neutral-600">{description}</div>
        </div>

        <div className="shrink-0 text-xs text-neutral-500">
          {formatDateTime(item.created_at)}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatActivityAction(action: string) {
  const labels: Record<string, string> = {
    "job.created": "Job created",
    "job.assigned": "Job assigned",
    "job.reassigned": "Job reassigned",
    "job.started": "Job started",
    "job.completed": "Job completed",
    "pod.uploaded": "Proof of delivery uploaded",
    "pod.deleted": "Proof of delivery deleted",
  };

  return labels[action] ?? action;
}

function formatActivityDescription(
  item: ActivityItem,
  drivers: Driver[],
  vehicles: Vehicle[]
) {
  const meta = item.meta ?? {};

  const driverName = getDriverName(meta.driver_id, drivers);
  const vehicleLabel = getVehicleLabel(meta.vehicle_id, vehicles);
  const jobNumber = getString(meta.job_number);
  const actionTime = getString(meta.at) || getString(meta.assigned_at);

  if (item.action === "job.created") {
    return jobNumber
      ? `${jobNumber} was created and added to the operations queue.`
      : "This job was created and added to the operations queue.";
  }

  if (item.action === "job.assigned") {
    if (driverName && vehicleLabel) {
      return `Assigned to ${driverName} using vehicle ${vehicleLabel}.`;
    }

    if (driverName) {
      return `Assigned to ${driverName}.`;
    }

    if (vehicleLabel) {
      return `Assigned with vehicle ${vehicleLabel}.`;
    }

    return "This job was assigned to a driver and vehicle.";
  }

  if (item.action === "job.reassigned") {
    if (driverName && vehicleLabel) {
      return `Reassigned to ${driverName} using vehicle ${vehicleLabel}.`;
    }

    return "This job was reassigned.";
  }

  if (item.action === "job.started") {
    return actionTime
      ? `Driver started the job at ${formatDateTime(actionTime)}.`
      : "Driver started the job.";
  }

  if (item.action === "job.completed") {
    return actionTime
      ? `Driver completed the job at ${formatDateTime(actionTime)}.`
      : "Driver completed the job.";
  }

  if (item.action === "pod.uploaded") {
    const size = getString(meta.size);

    if (size) {
      return `Proof of delivery was uploaded. File size: ${formatFileSize(size)}.`;
    }

    return "Proof of delivery was uploaded.";
  }

  if (item.action === "pod.deleted") {
    return "Proof of delivery was deleted.";
  }

  return "Activity recorded for this job.";
}

function getActivityChips(
  item: ActivityItem,
  drivers: Driver[],
  vehicles: Vehicle[]
) {
  const meta = item.meta ?? {};
  const chips: string[] = [];

  const jobNumber = getString(meta.job_number);
  const driverName = getDriverName(meta.driver_id, drivers);
  const vehicleLabel = getVehicleLabel(meta.vehicle_id, vehicles);

  if (jobNumber) {
    chips.push(`Job ${jobNumber}`);
  }

  if (driverName) {
    chips.push(`Driver: ${driverName}`);
  }

  if (vehicleLabel) {
    chips.push(`Vehicle: ${vehicleLabel}`);
  }

  return chips;
}

function getDriverName(value: unknown, drivers: Driver[]) {
  const driverId = getString(value);

  if (!driverId) {
    return "";
  }

  const driver = drivers.find((item) => item.id === driverId);

  return driver?.name ?? "Assigned driver";
}

function getVehicleLabel(value: unknown, vehicles: Vehicle[]) {
  const vehicleId = getString(value);

  if (!vehicleId) {
    return "";
  }

  const vehicle = vehicles.find((item) => item.id === vehicleId);

  return vehicle?.plate_no ?? "Assigned vehicle";
}

function getString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function formatFileSize(value: string) {
  const size = Number(value);

  if (!Number.isFinite(size)) {
    return value;
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}