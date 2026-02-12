// app/(app)/jobs/new/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Customer = { id: string; name: string };

export default function NewJobPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadCustomers() {
    const res = await fetch("/api/customers", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setCustomers(json.customers || []);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setSaving(true);

    try {
      if (!customerId) throw new Error("Select a customer");

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          pickup: pickup.trim(),
          dropoff: dropoff.trim(),
          scheduled_date: scheduledDate,
          notes: notes.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create job");

      router.push(`/jobs/${json.job.job_number}`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to create job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Create Job"
        subtitle="Jobs must link to a real customer. No free-text."
        action={
          <Link href="/jobs">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="text-sm font-medium text-neutral-900">Job details</div>
          <div className="mt-1 text-sm text-neutral-500">
            Select customer, then fill pickup/dropoff.
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <div className="mb-1 text-xs text-neutral-500">Customer</div>
              <div className="flex gap-2">
                <select
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <Link href="/customers/new">
                  <Button variant="outline" type="button">+ Customer</Button>
                </Link>
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs text-neutral-500">Scheduled date</div>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900"
                required
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-neutral-500">Pickup</div>
              <Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Tuas Warehouse A" />
            </div>

            <div>
              <div className="mb-1 text-xs text-neutral-500">Drop-off</div>
              <Input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Changi Cargo Complex" />
            </div>

            <div>
              <div className="mb-1 text-xs text-neutral-500">Notes</div>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                type="submit"
                disabled={saving || !customerId || !pickup.trim() || !dropoff.trim()}
              >
                {saving ? "Saving..." : "Create Job"}
              </Button>

              <Link href="/jobs">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>

              {msg ? <span className="text-sm text-red-600">{msg}</span> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
