"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
};

export default function DriversPage({ canManage }: { canManage: boolean }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null); // "new" = create
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/drivers?all=1", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load drivers");
      setDrivers(json.drivers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load drivers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openForm(driver?: Driver) {
    setEditingId(driver?.id ?? "new");
    setName(driver?.name ?? "");
    setPhone(driver?.phone ?? "");
    setError("");
    setMessage("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const creating = editingId === "new";
      const res = await fetch(
        creating ? "/api/drivers" : `/api/drivers/${editingId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save driver");
      setEditingId(null);
      setMessage(creating ? "Driver added." : "Driver updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save driver");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(driver: Driver) {
    if (driver.is_active && !window.confirm("Deactivate this driver? Existing jobs stay assigned, but no new jobs can be assigned.")) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !driver.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not change status");
      setMessage(driver.is_active ? "Driver deactivated." : "Driver activated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change status");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Drivers"
        subtitle={canManage ? "Manage drivers available for delivery assignments." : "View company drivers (Admin manages changes)."}
        action={canManage ? <Button variant="outline" onClick={() => openForm()}>+ Add Driver</Button> : undefined}
      />

      {error && <p role="alert" className="mb-4 rounded-md bg-white p-3 text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-md bg-white p-3 text-sm text-green-700">{message}</p>}

      {canManage && editingId && (
        <Card className="mb-4">
          <CardHeader><h2 className="text-sm font-semibold">{editingId === "new" ? "Add Driver" : "Edit Driver"}</h2></CardHeader>
          <CardContent>
            <form onSubmit={save} className="flex max-w-2xl flex-col gap-4">
              <label className="text-sm">Driver name *
                <Input className="mt-1" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required placeholder="Ahmad" />
              </label>
              <label className="text-sm">Phone (optional)
                <Input className="mt-1" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+65 9123 4567" />
              </label>
              <div className="flex gap-2">
                <Button variant="primary" type="submit" disabled={saving || !name.trim()}>{saving ? "Saving..." : "Save Driver"}</Button>
                <Button type="button" disabled={saving} onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-neutral-50 text-xs uppercase text-neutral-600">
                <tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Phone</th><th className="px-6 py-3">Status</th>{canManage && <th className="px-6 py-3">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td className="px-6 py-3 font-medium text-neutral-900">{driver.name}</td>
                    <td className="px-6 py-3">{driver.phone || "-"}</td>
                    <td className="px-6 py-3"><span className={`rounded-full px-2 py-1 text-xs ${driver.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-700"}`}>{driver.is_active ? "Active" : "Inactive"}</span></td>
                    {canManage && <td className="space-x-2 px-6 py-3">
                      <Button type="button" disabled={saving} onClick={() => openForm(driver)}>Edit</Button>
                      <Button type="button" disabled={saving} onClick={() => void toggle(driver)}>{driver.is_active ? "Deactivate" : "Activate"}</Button>
                    </td>}
                  </tr>
                ))}
                {!loading && drivers.length === 0 && <tr><td colSpan={canManage ? 4 : 3} className="px-6 py-10 text-center text-neutral-500">No drivers yet.</td></tr>}
                {loading && <tr><td colSpan={canManage ? 4 : 3} className="px-6 py-10 text-center text-neutral-500">Loading drivers...</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
