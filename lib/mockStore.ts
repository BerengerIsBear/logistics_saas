// lib/mockStore.ts
export type JobStatus = "pending" | "assigned" | "in_transit" | "delivered";

export type Job = {
  id: string;
  customer: string;
  pickup: string;
  dropoff: string;
  driver?: string;
  status: JobStatus;
  createdAt: string;
};

// Module-scope store (MVP only).
// Notes: resets on full reload / redeploy. Good enough for Phase 1.
let jobs: Job[] = [
  {
    id: "JOB-1001",
    customer: "ABC Trading",
    pickup: "Tuas Warehouse A",
    dropoff: "Changi Cargo Complex",
    driver: "Ahmad",
    status: "assigned",
    createdAt: new Date().toISOString(),
  },
  {
    id: "JOB-1002",
    customer: "Lion Logistics",
    pickup: "Jurong Port",
    dropoff: "Sengkang",
    driver: "Ben",
    status: "in_transit",
    createdAt: new Date().toISOString(),
  },
];

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getJobs(): Job[] {
  return jobs;
}

export function getJobById(id: string): Job | undefined {
  return jobs.find((j) => j.id === id);
}

export function addJob(input: Omit<Job, "id" | "createdAt">): Job {
  const nextNum =
    Math.max(
      1000,
      ...jobs
        .map((j) => Number(j.id.replace("JOB-", "")))
        .filter((n) => Number.isFinite(n))
    ) + 1;

  const job: Job = {
    id: `JOB-${nextNum}`,
    createdAt: new Date().toISOString(),
    ...input,
  };

  jobs = [job, ...jobs];
  notify();
  return job;
}

export function updateJobStatus(id: string, status: JobStatus): Job | undefined {
  let updated: Job | undefined;

  jobs = jobs.map((j) => {
    if (j.id !== id) return j;
    updated = { ...j, status };
    return updated;
  });

  if (updated) notify();
  return updated;
}
