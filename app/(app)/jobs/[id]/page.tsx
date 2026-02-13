// app/(app)/jobs/[id]/page.tsx
"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

type JobApiRow = {
  id: string; // DB uuid
  job_number: string;

  customer_id: string | null;
  customers?: { name: string } | null;
  customer?: string | null;

  pickup: string;
  dropoff: string;
  notes: string | null;

  status: JobStatus;

  scheduled_date: string | null;
  window_start: string | null;
  window_end: string | null;

  driver_id: string | null;
  vehicle_id: string | null;

  drivers?: { name: string } | null;
  vehicles?: { plate_no: string } | null;

  in_transit_at?: string | null;
  delivered_at?: string | null;
};

type PodRow = {
  id: string;
  job_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
  signedUrl: string | null;
};

type Driver = { id: string; name: string; phone?: string | null };
type Vehicle = { id: string; plate_no: string; type?: string | null };

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [job, setJob] = useState<JobApiRow | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [jobError, setJobError] = useState("");

  const [status, setStatus] = useState<JobStatus>("pending");
  const [savedMsg, setSavedMsg] = useState("");
  const [progressing, setProgressing] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const [pods, setPods] = useState<PodRow[]>([]);
  const [podLoading, setPodLoading] = useState(false);
  const [podError, setPodError] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const title = useMemo(() => job?.job_number ?? id, [job?.job_number, id]);
  const subtitle = useMemo(
    () => job?.customers?.name ?? job?.customer ?? "",
    [job?.customers?.name, job?.customer]
  );

  const canAssign = status === "pending" || status === "assigned";

  async function loadJob() {
    setLoadingJob(true);
    setJobError("");
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load job");
      setJob(json.job as JobApiRow);
      setStatus((json.job?.status as JobStatus) ?? "pending");

      setDriverId(json.job?.driver_id ?? "");
      setVehicleId(json.job?.vehicle_id ?? "");
    } catch (e: any) {
      setJobError(e?.message || "Failed to load job");
      setJob(null);
    } finally {
      setLoadingJob(false);
    }
  }

  useEffect(() => {
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, vRes] = await Promise.all([fetch("/api/drivers"), fetch("/api/vehicles")]);
        const dJson = await dRes.json();
        const vJson = await vRes.json();

        if (dRes.ok) setDrivers((dJson?.drivers ?? []) as Driver[]);
        if (vRes.ok) setVehicles((vJson?.vehicles ?? []) as Vehicle[]);
      } catch {
        // silent
      }
    })();
  }, []);

  async function loadPods(jobUuidOrJobNumber: string) {
    setPodError("");
    setPodLoading(true);
    try {
      const res = await fetch(`/api/pod?jobId=${encodeURIComponent(jobUuidOrJobNumber)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load POD");
      setPods(json.items || []);
    } catch (e: any) {
      setPodError(e?.message || "Failed to load POD");
    } finally {
      setPodLoading(false);
    }
  }

  useEffect(() => {
    if (!job) return;
    loadPods(job.id || id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  async function onProgress(action: "start" | "complete") {
    setSavedMsg("");
    setAssignError("");
    setProgressing(true);

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const json = await res.json();

      if (res.status === 401) {
        setSavedMsg("Session expired. Please login again.");
        return;
      }
      if (!res.ok) throw new Error(json?.error || "Action failed");

      await loadJob();

      setSavedMsg(action === "start" ? "Started!" : "Completed!");
      setTimeout(() => setSavedMsg(""), 1200);
    } catch (e: any) {
      setSavedMsg(e?.message || "Action failed");
    } finally {
      setProgressing(false);
    }
  }

  async function onAssign() {
    setAssignError("");
    setSavedMsg("");
    setAssigning(true);

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, vehicleId }),
      });

      const json = await res.json();

      if (res.status === 401) {
        setAssignError("Session expired. Please login again.");
        return;
      }
      if (!res.ok) throw new Error(json?.error || "Assign failed");

      await loadJob();

      setSavedMsg("Assigned!");
      setTimeout(() => setSavedMsg(""), 1200);
    } catch (e: any) {
      setAssignError(e?.message || "Assign failed");
    } finally {
      setAssigning(false);
    }
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setPodError("");
    setUploading(true);

    try {
      const jobKey = job?.id ?? id;

      for (const file of files) {
        const fd = new FormData();
        fd.append("jobId", jobKey);
        fd.append("file", file);

        const res = await fetch("/api/pod", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Upload failed: ${file.name}`);

        setPods((prev) => [json.item as PodRow, ...prev]);
      }
    } catch (e: any) {
      setPodError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removePod(podId: string) {
    setPodError("");

    const prev = pods;
    setPods((p) => p.filter((x) => x.id !== podId));

    try {
      const res = await fetch("/api/pod", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Delete failed");
    } catch (e: any) {
      setPods(prev);
      setPodError(e?.message || "Delete failed");
    }
  }

  if (loadingJob) {
    return (
      <PageShell>
        <PageHeader
          title="Loading..."
          subtitle="Fetching job details"
          action={
            <Link href="/jobs">
              <Button variant="outline">Back</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  if (!job) {
    return (
      <PageShell>
        <PageHeader
          title="Job not found"
          subtitle={jobError || `No job found for ID: ${id}`}
          action={
            <Link href="/jobs">
              <Button variant="outline">Back to Jobs</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap gap-2">
            {status === "assigned" ? (
              <Button
                variant="primary"
                type="button"
                disabled={progressing}
                onClick={() => onProgress("start")}
              >
                {progressing ? "Starting..." : "Start Job"}
              </Button>
            ) : null}

            {status === "in_transit" ? (
              <Button
                variant="primary"
                type="button"
                disabled={progressing}
                onClick={() => onProgress("complete")}
              >
                {progressing ? "Completing..." : "Complete Job"}
              </Button>
            ) : null}

            <Link href="/jobs">
              <Button variant="outline">Back</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-neutral-900">Job Info</div>
                <div className="mt-1 text-sm text-neutral-500">
                  View details and operate the job through workflow actions.
                </div>
              </div>
              <StatusBadge status={status} />
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-neutral-500">Pickup</div>
                <div className="mt-1 font-medium text-neutral-900">{job.pickup}</div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Drop-off</div>
                <div className="mt-1 font-medium text-neutral-900">{job.dropoff}</div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Driver</div>
                <div className="mt-1 font-medium text-neutral-900">{job.drivers?.name ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Vehicle</div>
                <div className="mt-1 font-medium text-neutral-900">
                  {job.vehicles?.plate_no ?? "-"}
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Status</div>
                <div className="mt-1 font-medium text-neutral-900">
                  {status === "in_transit"
                    ? "In Transit"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Scheduled</div>
                <div className="mt-1 font-medium text-neutral-900">{job.scheduled_date ?? "-"}</div>
              </div>
            </div>

            {job.notes ? (
              <div className="mt-6">
                <div className="text-xs text-neutral-500">Notes</div>
                <div className="mt-1 font-medium text-neutral-900">{job.notes}</div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="text-sm font-medium text-neutral-700">Assign</div>

              <div className="min-w-[220px]">
                <select
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm text-black"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                >
                  <option value="">Select driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[220px]">
                <select
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm text-black"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_no}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant="outline"
                type="button"
                onClick={onAssign}
                disabled={!canAssign || assigning || !driverId || !vehicleId}
              >
                {assigning ? "Assigning..." : "Assign"}
              </Button>

              {!canAssign ? (
                <span className="text-sm text-neutral-600">Assignment locked after start.</span>
              ) : null}

              {assignError ? <span className="text-sm text-red-600">{assignError}</span> : null}
            </div>

            <div className="mt-6 rounded-xl border bg-white p-3">
              <div className="text-sm font-medium text-neutral-900">Workflow</div>
              <div className="mt-1 text-xs text-neutral-600">
                Status is controlled by server rules: <span className="font-medium">Assign</span>{" "}
                sets <span className="font-medium">assigned</span>,{" "}
                <span className="font-medium">Start</span> sets{" "}
                <span className="font-medium">in transit</span>, and{" "}
                <span className="font-medium">Complete</span> sets{" "}
                <span className="font-medium">delivered</span>.
              </div>

              {savedMsg ? <div className="mt-2 text-sm text-neutral-700">{savedMsg}</div> : null}
            </div>
          </CardContent>
        </Card>

        {/* POD (unchanged) */}
        {/* ...the rest of your POD UI stays the same... */}
      </div>
    </PageShell>
  );
}
