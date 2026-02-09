// lib/mockStore.ts
export type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

export type Job = {
  id: string; // e.g. JOB-1001
  customer: string;
  pickup: string;
  dropoff: string;
  driver?: string;
  status: JobStatus;
  notes?: string;
  createdAt: number; // for sorting later
};

type NewJobInput = {
  customer: string;
  pickup: string;
  dropoff: string;
  driver?: string;
  status: JobStatus;
  notes?: string;
};

let jobs: Job[] = [
  {
    id: "JOB-1001",
    customer: "ABC Trading",
    pickup: "Tuas Warehouse A",
    dropoff: "Changi Cargo Complex",
    driver: "Ahmad",
    status: "assigned",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: "JOB-1002",
    customer: "Lion Logistics",
    pickup: "Jurong Port",
    dropoff: "Sengkang",
    driver: "Ben",
    status: "in_transit",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

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

function nextJobId() {
  const nums = jobs
    .map((j) => Number(j.id.replace("JOB-", "")))
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
    status: input.status,
    notes: input.notes || undefined,
    createdAt: Date.now(),
  };

  jobs = [job, ...jobs]; // newest first (nice default)
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
