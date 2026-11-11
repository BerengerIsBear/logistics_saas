"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getFinancialTotals, type JobFinancials } from "@/lib/jobs/finance";

const keys = ["revenue", "driver_cost", "fuel_cost", "vehicle_cost", "other_cost"] as const;
type Key = (typeof keys)[number];
type FormData = Record<Key, string>;

const labels: Record<Key, string> = {
  revenue: "Job revenue",
  driver_cost: "Driver cost",
  fuel_cost: "Fuel cost",
  vehicle_cost: "Vehicle cost",
  other_cost: "Other cost",
};

const emptyForm: FormData = {
  revenue: "", driver_cost: "0.00", fuel_cost: "0.00",
  vehicle_cost: "0.00", other_cost: "0.00",
};

function toForm(saved: JobFinancials | null): FormData {
  return saved ? {
    revenue: saved.revenue === null ? "" : String(saved.revenue),
    driver_cost: String(saved.driver_cost),
    fuel_cost: String(saved.fuel_cost),
    vehicle_cost: String(saved.vehicle_cost),
    other_cost: String(saved.other_cost),
  } : { ...emptyForm };
}

function validMoney(value: string) {
  return /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value.trim()) &&
    Number(value) <= 9999999999.99;
}

function money(value: number) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(value);
}

export default function JobFinancialCard({
  jobNumber,
  onSaved,
}: {
  jobNumber: string;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessage("");
    fetch(`/api/jobs/${encodeURIComponent(jobNumber)}/financials`, { cache: "no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load finances");
        if (!cancelled) setForm(toForm(result.financials));
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load finances");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobNumber]);

  const isValid = keys.every(key =>
    key === "revenue" && form.revenue.trim() === "" ? true : validMoney(form[key])
  );

  const financials: JobFinancials | null = isValid ? {
    revenue: form.revenue.trim() === "" ? null : Number(form.revenue),
    driver_cost: Number(form.driver_cost),
    fuel_cost: Number(form.fuel_cost),
    vehicle_cost: Number(form.vehicle_cost),
    other_cost: Number(form.other_cost),
  } : null;

  const totals = financials ? getFinancialTotals(financials) : null;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) {
      setError("Enter amounts of 0 or more, with up to 2 decimal places.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobNumber)}/financials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, revenue: form.revenue.trim() || null }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not save finances");
      setForm(toForm(result.financials));
      setMessage("Financial details saved.");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save finances");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-neutral-900">Revenue & Costs</div>
        <div className="mt-1 text-sm text-neutral-500">
          Admin only · SGD · Enter figures manually for this job.
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-neutral-500">Loading financial details...</p> : (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {keys.map(key => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-700">
                    {labels[key]} (SGD)
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max="9999999999.99"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={key === "revenue" ? "Not entered" : "0.00"}
                    value={form[key]}
                    onChange={event => {
                      setForm(previous => ({ ...previous, [key]: event.target.value }));
                      setError("");
                      setMessage("");
                    }}
                  />
                </label>
              ))}
            </div>

            {totals && (
              <div className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-neutral-500">Total Cost</div>
                  <div className="text-lg font-semibold text-neutral-900">{money(totals.total_cost)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Job Profit</div>
                  <div className={`text-lg font-semibold ${totals.profit !== null && totals.profit < 0 ? "text-red-700" : "text-neutral-900"}`}>
                    {totals.profit === null ? "—" : money(totals.profit)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Profit Margin</div>
                  <div className={`text-lg font-semibold ${totals.profit !== null && totals.profit < 0 ? "text-red-700" : "text-neutral-900"}`}>
                    {totals.margin === null ? "—" : `${totals.margin.toFixed(2)}%`}
                  </div>
                </div>
                {totals.profit !== null && totals.profit < 0 && (
                  <div className="text-sm font-medium text-red-700 sm:col-span-3">
                    Loss-making job: costs exceed revenue.
                  </div>
                )}
                {financials?.revenue === null && (
                  <div className="text-xs text-neutral-500 sm:col-span-3">
                    Enter revenue to calculate profit and margin.
                  </div>
                )}
              </div>
            )}

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {message && <p role="status" className="text-sm text-green-700">{message}</p>}
            <Button type="submit" variant="primary" disabled={saving || !isValid}>
              {saving ? "Saving..." : "Save Financials"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
