// app/(app)/jobs/[id]/page.tsx
"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";

type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

type JobApiRow = {
  id: string; // DB uuid
  job_number: string;

  // customer (joined)
  customer_id: string | null;
  customers?: { name: string } | null;
  customer?: string | null; // snapshot fallback

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

export default function JobDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params); // this is job_number in your routing

  const [job, setJob] = useState<JobApiRow | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [jobError, setJobError] = useState("");

  const [status, setStatus] = useState<JobStatus>("pending");
  const [savedMsg, setSavedMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [progressing, setProgressing] = useState(false);

  // Assignments
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // POD
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

  async function loadJob() {
    setLoadingJob(true);
    setJobError("");
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load job");
      setJob(json.job as JobApiRow);
      setStatus((json.job?.status as JobStatus) ?? "pending");

      // prefill dropdowns based on saved IDs
      setDriverId(json.job?.driver_id ?? "");
      setVehicleId(json.job?.vehicle_id ?? "");
    } catch (e: any) {
      setJobError(e?.message || "Failed to load job");
      setJob(null);
    } finally {
      setLoadingJob(false);
    }
  }

  // load job
  useEffect(() => {
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // load drivers + vehicles for dropdowns
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

  // POD uses DB job UUID (preferred). Falls back to job_number only if missing.
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

  // load pods when job loads
  useEffect(() => {
    if (!job) return;
    loadPods(job.id || id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  async function onSave() {
    setSavedMsg("");
    setSaving(true);

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const json = await res.json();

      if (res.status === 401) {
        setSavedMsg("Session expired. Please login again.");
        return;
      }
      if (!res.ok) throw new Error(json?.error || "Failed to save status");

      await loadJob();

      setSavedMsg("Saved!");
      setTimeout(() => setSavedMsg(""), 1200);
    } catch (e: any) {
      setSavedMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

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
        {/* Job Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-neutral-900">Job Info</div>
                <div className="mt-1 text-sm text-neutral-500">
                  View details and update the job status.
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

            {/* Assign driver + vehicle */}
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
                disabled={assigning || !driverId || !vehicleId}
              >
                {assigning ? "Assigning..." : "Assign"}
              </Button>

              {assignError ? <span className="text-sm text-red-600">{assignError}</span> : null}
            </div>

            {/* Update status */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="text-sm font-medium text-neutral-700">Update status</div>

              <div className="min-w-[220px]">
                <Select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                </Select>
              </div>

              <Button variant="primary" type="button" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>

              {savedMsg ? <span className="text-sm text-neutral-700">{savedMsg}</span> : null}
            </div>
          </CardContent>
        </Card>

        {/* POD */}
        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-neutral-900">Proof of Delivery</div>
            <div className="mt-1 text-sm text-neutral-500">Private bucket. Served via signed URLs.</div>
          </CardHeader>

          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              multiple
              onChange={onPickFiles}
            />

            <div className="rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center">
              <div className="text-sm font-medium text-neutral-900">Upload POD</div>
              <p className="mt-1 text-xs text-neutral-500">Images preview. PDFs open in a new tab.</p>

              <div className="mt-4 flex justify-center gap-2">
                <Button variant="outline" type="button" onClick={openPicker} disabled={uploading}>
                  {uploading ? "Uploading..." : "Choose File"}
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => loadPods(job.id || id)}
                  disabled={podLoading}
                >
                  {podLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {podError ? <div className="mt-3 text-sm text-red-600">{podError}</div> : null}

            {podLoading ? (
              <div className="mt-4 text-xs text-neutral-500">Loading POD...</div>
            ) : pods.length === 0 ? (
              <div className="mt-4 text-xs text-neutral-500">No POD uploaded yet.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {pods.map((p) => {
                  const mime = p.mime_type || "";
                  const isImage = mime.startsWith("image/");
                  const isPdf = mime === "application/pdf";

                  return (
                    <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-neutral-900">{p.file_name}</div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {isPdf ? "PDF" : isImage ? "Image" : mime || "File"} • {formatBytes(p.size ?? 0)}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="shrink-0 text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
                          onClick={() => removePod(p.id)}
                        >
                          Remove
                        </button>
                      </div>

                      {p.signedUrl ? (
                        isImage ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.signedUrl} alt={p.file_name} className="h-40 w-full object-cover" />
                          </div>
                        ) : isPdf ? (
                          <div className="mt-3 text-sm">
                            <a
                              href={p.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-neutral-900 underline underline-offset-2"
                            >
                              Open PDF
                            </a>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm">
                            <a
                              href={p.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-neutral-900 underline underline-offset-2"
                            >
                              Open file
                            </a>
                          </div>
                        )
                      ) : (
                        <div className="mt-3 text-xs text-neutral-500">Signed URL missing. Click Refresh.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
