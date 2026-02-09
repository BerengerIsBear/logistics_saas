// app/(app)/jobs/[id]/page.tsx
"use client";

import { use, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getJobs, subscribe, updateJobStatus, type JobStatus } from "@/lib/mockStore";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PodItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string; // object URL
  uploadedAt: number;
};

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
  const { id } = use(params);

  // reactive job lookup
  const jobs = useSyncExternalStore(subscribe, getJobs, getJobs);
  const job = useMemo(() => jobs.find((j) => j.id === id), [jobs, id]);

  const [status, setStatus] = useState<JobStatus>(job?.status ?? "pending");
  const [savedMsg, setSavedMsg] = useState("");

  // POD (mock-only, in-memory)
  const [pods, setPods] = useState<PodItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // keep local status in sync if store changes
  useEffect(() => {
    if (job) setStatus(job.status);
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      pods.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!job) {
    return (
      <PageShell>
        <PageHeader
          title="Job not found"
          subtitle={`No job found for ID: ${id}`}
          action={
            <Link href="/jobs">
              <Button variant="outlineDark">Back to Jobs</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  function onSave() {
    updateJobStatus(id, status);
    setSavedMsg("Saved!");
    setTimeout(() => setSavedMsg(""), 1200);
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const next: PodItem[] = files.map((file) => {
      const url = URL.createObjectURL(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        url,
        uploadedAt: Date.now(),
      };
    });

    setPods((prev) => [...next, ...prev]);

    // allow picking same file again
    e.target.value = "";
  }

  function removePod(podId: string) {
    setPods((prev) => {
      const target = prev.find((p) => p.id === podId);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== podId);
    });
  }

  return (
    <PageShell>
      <PageHeader
        title={job.id}
        subtitle={job.customer}
        action={
          <Link href="/jobs">
            <Button variant="outlineDark">Back</Button>
          </Link>
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
                <div className="mt-1 font-medium text-neutral-900">{job.driver ?? "-"}</div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Status</div>
                <div className="mt-1 font-medium text-neutral-900">
                  {status === "in_transit"
                    ? "In Transit"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
              </div>
            </div>

            {job.notes ? (
              <div className="mt-6">
                <div className="text-xs text-neutral-500">Notes</div>
                <div className="mt-1 font-medium text-neutral-900">{job.notes}</div>
              </div>
            ) : null}

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

              <Button variant="primary" type="button" onClick={onSave}>
                Save
              </Button>

              {savedMsg ? <span className="text-sm text-neutral-700">{savedMsg}</span> : null}
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              (MVP: Save updates the mock store only. Later we’ll save to Supabase.)
            </p>
          </CardContent>
        </Card>

        {/* POD Upload (mock) */}
        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-neutral-900">Proof of Delivery</div>
            <div className="mt-1 text-sm text-neutral-500">
              Upload photo / signature / PDF (mock-only for now).
            </div>
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
              <p className="mt-1 text-xs text-neutral-500">
                Images show preview. PDFs show an open link.
              </p>

              <div className="mt-4">
                <Button variant="outline" type="button" onClick={openPicker}>
                  Choose File
                </Button>
              </div>
            </div>

            {pods.length > 0 ? (
              <div className="mt-4 space-y-3">
                {pods.map((p) => {
                  const isImage = p.type.startsWith("image/");
                  const isPdf = p.type === "application/pdf";

                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-neutral-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-neutral-900">
                            {p.name}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {isPdf ? "PDF" : isImage ? "Image" : p.type || "File"} •{" "}
                            {formatBytes(p.size)}
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

                      {isImage ? (
                        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={p.name} className="h-40 w-full object-cover" />
                        </div>
                      ) : isPdf ? (
                        <div className="mt-3 text-sm">
                          <a
                            href={p.url}
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
                            href={p.url}
                            download={p.name}
                            className="text-neutral-900 underline underline-offset-2"
                          >
                            Download file
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 text-xs text-neutral-500">
                No POD uploaded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
