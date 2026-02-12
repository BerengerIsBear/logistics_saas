// lib/mockStore.ts
export type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

export type Job = {
  id: string; // UI uses job_number (e.g. JOB-1001)
  customer: string;
  pickup: string;
  dropoff: string;
  scheduled_date?: string; // YYYY-MM-DD
  driver?: string;
  vehicle?: string; // e.g. plate no
  status: JobStatus;
  notes?: string;
  createdAt: number;
};

type NewJobInput = {
  customer: string;
  pickup: string;
  dropoff: string;
  driver?: string;
  status: JobStatus;
  notes?: string;
};

// Start empty. Hydrate from Supabase via API.
let jobs: Job[] = [];

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getJobs() {
  return jobs;
}

export function getJobById(id: string) {
  return jobs.find((j) => j.id === id);
}

/**
 * Option A bridge (client-safe):
 * Fetch from our Next.js API route (server talks to Supabase using service role)
 *
 * queryString can be:
 *  - "" (default)
 *  - "?q=JOB-1001&status=assigned"
 *  - "q=JOB-1001&status=assigned"
 */
export async function hydrateJobsFromSupabase(queryString: string = "") {
  const qs =
    queryString && queryString.startsWith("?")
      ? queryString
      : queryString
      ? `?${queryString}`
      : "";

  const res = await fetch(`/api/jobs${qs}`, { cache: "no-store" });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error || "Failed to load jobs");
  }

  const rows = (json?.jobs ?? []) as any[];

  jobs = rows.map((j: any) => {
    const driverName = j?.drivers?.name ?? j?.driver ?? undefined;
    const vehiclePlate = j?.vehicles?.plate_no ?? j?.vehicle ?? undefined;

    return {
      id: j.job_number ?? String(j.id),
      customer: j.customer,
      pickup: j.pickup,
      dropoff: j.dropoff,
      scheduled_date: j.scheduled_date ?? undefined,
      driver: driverName ?? undefined,
      vehicle: vehiclePlate ?? undefined,
      status: (j.status as JobStatus) ?? "pending",
      notes: j.notes ?? undefined,
      createdAt: j.created_at ? new Date(j.created_at).getTime() : Date.now(),
    };
  });

  emit();
}

// --- keep these for now (fallback / local actions) ---

function nextJobId() {
  const nums = jobs
    .map((j) => Number(String(j.id).replace("JOB-", "")))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return `JOB-${max + 1}`;
}

export function addJob(input: NewJobInput) {
  const job: Job = {
    id: nextJobId(),
    customer: input.customer,
    pickup: input.pickup,
    dropoff: input.dropoff,
    driver: input.driver || undefined,
    vehicle: undefined,
    status: input.status,
    notes: input.notes || undefined,
    createdAt: Date.now(),
  };

  jobs = [job, ...jobs];
  emit();
  return job;
}

export function updateJobStatus(id: string, status: JobStatus) {
  let changed = false;

  jobs = jobs.map((j) => {
    if (j.id !== id) return j;
    changed = true;
    return { ...j, status };
  });

  if (changed) emit();
}

export function updateJobNotes(id: string, notes?: string) {
  let changed = false;

  jobs = jobs.map((j) => {
    if (j.id !== id) return j;
    changed = true;
    return { ...j, notes: notes?.trim() || undefined };
  });

  if (changed) emit();
}

