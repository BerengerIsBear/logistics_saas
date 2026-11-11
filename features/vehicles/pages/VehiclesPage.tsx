"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Vehicle = {
  id: string;
  plate_no: string;
  type: string | null;
  is_active: boolean;
};

export default function VehiclesPage({ canManage }: { canManage: boolean }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [plateNo, setPlateNo] = useState("");
  const [type, setType] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vehicles?all=1", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load vehicles");
      setVehicles(json.vehicles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vehicles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openForm(vehicle?: Vehicle) {
    setEditingId(vehicle?.id ?? "new");
    setPlateNo(vehicle?.plate_no ?? "");
    setType(vehicle?.type ?? "");
    setError("");
    setMessage("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!plateNo.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const creating = editingId === "new";
      const res = await fetch(
        creating ? "/api/vehicles" : `/api/vehicles/${editingId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plateNo: plateNo.trim(), type: type.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save vehicle");
      setEditingId(null);
      setMessage(creating ? "Vehicle added." : "Vehicle updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vehicle");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(vehicle: Vehicle) {
    if (vehicle.is_active && !window.confirm("Deactivate this vehicle? Existing jobs stay assigned, but no new jobs can be assigned.")) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !vehicle.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not change status");
      setMessage(vehicle.is_active ? "Vehicle deactivated." : "Vehicle activated.");
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
        title="Vehicles"
        subtitle={canManage ? "Manage vehicles available for delivery assignments." : "View company vehicles (Admin manages changes)."}
        action={canManage ? <Button variant="outline" onClick={() => openForm()}>+ Add Vehicle</Button> : undefined}
      />

      {error && <p role="alert" className="mb-4 rounded-md bg-white p-3 text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-md bg-white p-3 text-sm text-green-700">{message}</p>}

      {canManage && editingId && (
        <Card className="mb-4">
          <CardHeader><h2 className="text-sm font-semibold">{editingId === "new" ? "Add Vehicle" : "Edit Vehicle"}</h2></CardHeader>
          <CardContent>
            <form onSubmit={save} className="flex max-w-2xl flex-col gap-4">
              <label className="text-sm">Plate number *
                <Input className="mt-1" value={plateNo} maxLength={30} onChange={(e) => setPlateNo(e.target.value)} required placeholder="SGX1234A" />
              </label>
              <label className="text-sm">Vehicle type (optional)
                <Input className="mt-1" value={type} maxLength={80} onChange={(e) => setType(e.target.value)} placeholder="Van / Truck" />
              </label>
              <div className="flex gap-2">
                <Button variant="primary" type="submit" disabled={saving || !plateNo.trim()}>{saving ? "Saving..." : "Save Vehicle"}</Button>
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
                <tr><th className="px-6 py-3">Plate number</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Status</th>{canManage && <th className="px-6 py-3">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="px-6 py-3 font-medium text-neutral-900">{vehicle.plate_no}</td>
                    <td className="px-6 py-3">{vehicle.type || "-"}</td>
                    <td className="px-6 py-3"><span className={`rounded-full px-2 py-1 text-xs ${vehicle.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-700"}`}>{vehicle.is_active ? "Active" : "Inactive"}</span></td>
                    {canManage && <td className="space-x-2 px-6 py-3">
                      <Button type="button" disabled={saving} onClick={() => openForm(vehicle)}>Edit</Button>
                      <Button type="button" disabled={saving} onClick={() => void toggle(vehicle)}>{vehicle.is_active ? "Deactivate" : "Activate"}</Button>
                    </td>}
                  </tr>
                ))}
                {!loading && vehicles.length === 0 && <tr><td colSpan={canManage ? 4 : 3} className="px-6 py-10 text-center text-neutral-500">No vehicles yet.</td></tr>}
                {loading && <tr><td colSpan={canManage ? 4 : 3} className="px-6 py-10 text-center text-neutral-500">Loading vehicles...</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
