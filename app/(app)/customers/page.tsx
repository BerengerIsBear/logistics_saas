// app/(app)/customers/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/customers${qs}`, { cache: "no-store" });
      const json = await res.json();

      if (res.status === 401) throw new Error("Session expired. Please login again.");
      if (!res.ok) throw new Error(json?.error || "Failed to load customers");

      setItems((json.customers || []) as Customer[]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load customers");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = useMemo(() => items.length, [items.length]);

  return (
    <PageShell>
      <PageHeader
        title="Customers"
        subtitle="Keep customer contacts clean so dispatching is faster."
        action={
          <div className="flex gap-2">
            <Link href="/customers/new?next=/customers">
              <Button variant="outline">+ New Customer</Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="flex-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name / phone / email..."
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" type="submit" disabled={loading}>
                {loading ? "Loading..." : "Search"}
              </Button>

              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setQ("");
                  setTimeout(load, 0);
                }}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </form>

          <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
            <div>
              Showing <span className="font-medium text-neutral-900">{count}</span> customer(s)
            </div>
            {err ? <div className="text-red-600">{err}</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Created</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/70">
                    <td className="px-6 py-3 font-medium text-neutral-900">{c.name}</td>
                    <td className="px-6 py-3">{c.phone || "-"}</td>
                    <td className="px-6 py-3">{c.email || "-"}</td>
                    <td className="px-6 py-3">
                      {c.created_at ? new Date(c.created_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}

                {!loading && items.length === 0 && !err && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center">
                      <div className="text-sm text-neutral-500">No customers yet.</div>
                      <div className="mt-3">
                        <Link href="/customers/new?next=/customers">
                          <Button variant="primary">Create first customer</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}

                {err && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center">
                      <div className="text-sm text-red-600">{err}</div>
                      <div className="mt-3">
                        <Button variant="outline" type="button" onClick={load} disabled={loading}>
                          Retry
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
