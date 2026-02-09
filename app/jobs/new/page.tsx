// app/jobs/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addJob, type JobStatus } from "@/lib/mockStore";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type NewJob = {
  customer: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: JobStatus;
  notes: string;
};

export default function NewJobPage() {
  const router = useRouter();

  const [form, setForm] = useState<NewJob>({
    customer: "",
    pickup: "",
    dropoff: "",
    driver: "",
    status: "pending",
    notes: "",
  });

  function update<K extends keyof NewJob>(key: K, value: NewJob[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

      addJob({
        customer: form.customer.trim(),
        pickup: form.pickup.trim(),
        dropoff: form.dropoff.trim(),
        driver: form.driver.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      });


    router.push("/jobs");
  }

  return (
    <PageShell>
      <PageHeader
        title="Create Job"
        subtitle="Add a new delivery job (MVP form)."
        action={
          <Button variant="outlineDark" type="button" onClick={() => router.push("/jobs")}>
            Back
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader className="bg-white">
          <div className="text-sm font-medium text-neutral-900">Job Details</div>
          <div className="mt-1 text-sm text-neutral-500">
            Fill in the required fields and save.
          </div>
        </CardHeader>

        <CardContent className="bg-white">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-neutral-700">Customer</label>
                <div className="mt-1">
                  <Input
                    value={form.customer}
                    onChange={(e) => update("customer", e.target.value)}
                    placeholder="ABC Trading"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Driver <span className="text-neutral-400">(optional)</span>
                </label>
                <div className="mt-1">
                  <Input
                    value={form.driver}
                    onChange={(e) => update("driver", e.target.value)}
                    placeholder="Ahmad"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Pickup</label>
              <div className="mt-1">
                <Input
                  value={form.pickup}
                  onChange={(e) => update("pickup", e.target.value)}
                  placeholder="Tuas Warehouse A"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Drop-off</label>
              <div className="mt-1">
                <Input
                  value={form.dropoff}
                  onChange={(e) => update("dropoff", e.target.value)}
                  placeholder="Changi Cargo Complex"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-neutral-700">Status</label>
                <div className="mt-1">
                  <Select
                    value={form.status}
                    onChange={(e) => update("status", e.target.value as JobStatus)}
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Notes <span className="text-neutral-400">(optional)</span>
                </label>
                <div className="mt-1">
                  <Input
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Fragile / call before arrival"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button variant="primary" type="submit">
                Save Job
              </Button>

              <span className="text-xs text-neutral-500">
                Saves into mock store and redirects. (Supabase later.)
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
