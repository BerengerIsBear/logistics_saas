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
  job_id: string; // stored as job_number TEXT (JOB-xxxx) in DB
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
  signedUrl: string | null;
};

type ActivityRow = {
  id: string;
  company_id: string;
  job_id: string; // activity uses job UUID
  action: string;
  actor_user_id: string | null;
  meta: any | null;
  created_at: string;
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

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}

function formatStatusLabel(s: JobStatus) {
  if (s === "in_transit") return "In Transit";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function activityTitle(a: ActivityRow) {
  const meta = a.meta || {};
  switch (a.action) {
    case "job.created":
      return "Job created";
    case "job.updated":
      return "Job updated";
    case "job.assigned":
      return "Assigned to driver";
    case "job.reassigned":
      return "Reassigned";
    case "job.started":
      return "Job started";
    case "job.completed":
      return "Job completed";
    case "pod.uploaded":
      return meta?.file_name ? `POD uploaded: ${meta.file_name}` : "POD uploaded";
    case "pod.deleted":
      return meta?.file_name ? `POD deleted: ${meta.file_name}` : "POD deleted";
    default:
      return a.action;
  }
}

function activitySubtitle(a: ActivityRow) {
  const meta = a.meta || {};
  if (a.action === "pod.uploaded" || a.action === "pod.deleted") {
    const size = Number(meta?.size);
    const sizeLabel = Number.isFinite(size) ? formatBytes(size) : "";
    return sizeLabel ? sizeLabel : "";
  }
  if (a.action === "job.assigned" || a.action === "job.reassigned") {
    // keep it simple (no UUID spam)
    return "";
  }
  return "";
}

function isImageMime(mime?: string | null) {
  return !!mime && mime.startsWith("image/");
}
function isPdfMime(mime?: string | null) {
  return !!mime && mime === "application/pdf";
}

export default function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const jobNumberFromUrl = decodeURIComponent(id);

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

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fullscreen image preview
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  const title = useMemo(
    () => job?.job_number ?? jobNumberFromUrl,
    [job?.job_number, jobNumberFromUrl]
  );
  const subtitle = useMemo(
    () => job?.customers?.name ?? job?.customer ?? "",
    [job?.customers?.name, job?.customer]
  );

  const canAssign = status === "pending" || status === "assigned";

  async function loadJob() {
    setLoadingJob(true);
    setJobError("");
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobNumberFromUrl)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load job");

      setJob(json.job as JobApiRow);

      const s = (json.job?.status as JobStatus) ?? "pending";
      setStatus(s);

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
  }, [jobNumberFromUrl]);

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

  async function loadPods(jobNumber: string) {
    setPodError("");
    setPodLoading(true);
    try {
      const res = await fetch(`/api/pod?jobId=${encodeURIComponent(jobNumber)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load POD");
      setPods(json.items || []);
    } catch (e: any) {
      setPodError(e?.message || "Failed to load POD");
      setPods([]);
    } finally {
      setPodLoading(false);
    }
  }

  async function loadActivity(jobUuid: string) {
    setActivityError("");
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/activity?jobId=${encodeURIComponent(jobUuid)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load activity");
      setActivity((json.items ?? []) as ActivityRow[]);
    } catch (e: any) {
      setActivityError(e?.message || "Failed to load activity");
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }

  useEffect(() => {
    if (!job) return;
    loadPods(job.job_number || jobNumberFromUrl); // pod uses job_number
    loadActivity(job.id); // activity uses UUID
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  async function onProgress(action: "start" | "complete") {
    setSavedMsg("");
    setAssignError("");
    setProgressing(true);

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobNumberFromUrl)}/progress`, {
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
      if (job?.id) await loadActivity(job.id);

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
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobNumberFromUrl)}/assign`, {
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
      if (job?.id) await loadActivity(job.id);

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
      const jobKey = job?.job_number ?? jobNumberFromUrl;

      for (const file of files) {
        const fd = new FormData();
        fd.append("jobId", jobKey);
        fd.append("file", file);

        const res = await fetch("/api/pod", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Upload failed: ${file.name}`);

        setPods((prev) => [json.item as PodRow, ...prev]);
      }

      if (job?.id) await loadActivity(job.id);
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

      if (job?.id) await loadActivity(job.id);
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
          subtitle={jobError || `No job found for ID: ${jobNumberFromUrl}`}
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
        {/* LEFT */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-neutral-900">Job Info</div>
                <div className="mt-1 text-sm text-neutral-500">Details + operations.</div>
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
                <div className="mt-1 font-medium text-neutral-900">{formatStatusLabel(status)}</div>
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

            {/* Assign */}
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

              {assignError ? <span className="text-sm text-red-600">{assignError}</span> : null}
            </div>

            {savedMsg ? <div className="mt-4 text-sm text-neutral-700">{savedMsg}</div> : null}

            {/* Activity */}
            <div className="mt-6 rounded-xl border bg-white p-3">
              <div className="text-sm font-medium text-neutral-900">Activity</div>

              {activityError ? <div className="mt-2 text-sm text-red-600">{activityError}</div> : null}
              {activityLoading ? (
                <div className="mt-2 text-sm text-neutral-600">Loading activity...</div>
              ) : null}

              {!activityLoading && activity.length === 0 ? (
                <div className="mt-2 text-sm text-neutral-600">No activity yet.</div>
              ) : null}

              {!activityLoading && activity.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {activity.map((a) => {
                    const sub = activitySubtitle(a);
                    return (
                      <div key={a.id} className="rounded-lg border bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-neutral-900">
                              {activityTitle(a)}
                            </div>
                            {sub ? <div className="mt-0.5 text-xs text-neutral-600">{sub}</div> : null}
                            <div className="mt-1 text-xs text-neutral-500">
                              {timeAgo(a.created_at)} • {formatDateTime(a.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: POD */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-neutral-900">POD</div>
                <div className="mt-1 text-sm text-neutral-500">Upload and view proof of delivery.</div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={onPickFiles}
                  accept="image/*,application/pdf"
                />
                <Button variant="outline" type="button" onClick={openPicker} disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {podError ? <div className="mb-2 text-sm text-red-600">{podError}</div> : null}

            <div className="text-xs text-neutral-500">
              Job key: <span className="font-medium text-neutral-900">{job.job_number}</span>
            </div>

            {podLoading ? <div className="mt-2 text-sm text-neutral-600">Loading POD...</div> : null}

            {!podLoading && pods.length === 0 ? (
              <div className="mt-2 text-sm text-neutral-600">No POD uploaded yet.</div>
            ) : null}

            <div className="mt-3 space-y-3">
              {pods.map((p) => {
                const showImg = p.signedUrl && isImageMime(p.mime_type);
                const showPdf = p.signedUrl && isPdfMime(p.mime_type);

                return (
                  <div key={p.id} className="rounded-lg border bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-neutral-900">{p.file_name}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {p.size ? formatBytes(p.size) : ""}
                          {p.mime_type ? ` • ${p.mime_type}` : ""} • {formatDateTime(p.created_at)}
                        </div>
                      </div>

                      <Button variant="outline" type="button" onClick={() => removePod(p.id)}>
                        Delete
                      </Button>
                    </div>

                    {/* Wider horizontal image */}
                    {showImg ? (
                      <button
                        type="button"
                        className="mt-3 block w-full overflow-hidden rounded-xl border bg-neutral-50"
                        onClick={() => setPreview({ url: p.signedUrl!, name: p.file_name })}
                        aria-label={`Open ${p.file_name}`}
                      >
                        <img
                          src={p.signedUrl!}
                          alt={p.file_name}
                          className="h-auto w-full max-h-[260px] object-contain"
                        />
                      </button>
                    ) : null}

                    {showPdf ? (
                      <div className="mt-3 rounded-xl border bg-neutral-50 p-3">
                        <div className="text-sm text-neutral-900">PDF</div>
                        <a
                          className="mt-1 inline-block text-sm text-neutral-900 underline"
                          href={p.signedUrl!}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open PDF
                        </a>
                      </div>
                    ) : null}

                    {!p.signedUrl ? <div className="mt-3 text-xs text-neutral-500">No signed URL</div> : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen image modal */}
      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="truncate text-sm font-medium text-white">{preview.name}</div>
              <Button variant="outline" type="button" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>

            <div className="overflow-auto rounded-2xl bg-black">
              <img src={preview.url} alt={preview.name} className="h-auto w-full object-contain" />
            </div>

            <div className="mt-2 text-xs text-white/70">Tip: scroll / pinch zoom (trackpad / mobile)</div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
