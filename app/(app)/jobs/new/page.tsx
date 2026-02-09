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

type Errors = {
  customer?: string;
  pickup?: string;
  dropoff?: string;
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

  const [errors, setErrors] = useState<Errors>({});

  function update<K extends keyof NewJob>(key: K, value: NewJob[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));

    // clear error as user edits
    if (key === "customer" || key === "pickup" || key === "dropoff") {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const customer = form.customer.trim();
    const pickup = form.pickup.trim();
    const dropoff = form.dropoff.trim();

    const nextErrors: Errors = {};
    if (!customer) nextErrors.customer = "Customer is required";
    if (!pickup) nextErrors.pickup = "Pickup is required";
    if (!dropoff) nextErrors.dropoff = "Drop-off is required";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    addJob({
      customer,
      pickup,
      dropoff,
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
          <Button
            variant="outlineDark"
            type="button"
            onClick={() => router.push("/jobs")}
          >
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
                  />
                  {errors.customer ? (
                    <div className="mt-1 text-xs text-red-600">{errors.customer}</div>
                  ) : null}
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
                />
                {errors.pickup ? (
                  <div className="mt-1 text-xs text-red-600">{errors.pickup}</div>
                ) : null}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Drop-off</label>
              <div className="mt-1">
                <Input
                  value={form.dropoff}
                  onChange={(e) => update("dropoff", e.target.value)}
                  placeholder="Changi Cargo Complex"
                />
                {errors.dropoff ? (
                  <div className="mt-1 text-xs text-red-600">{errors.dropoff}</div>
                ) : null}
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
