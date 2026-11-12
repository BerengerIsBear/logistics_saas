"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Role } from "@/lib/auth/access";

type Employee = {
  id: string;
  email: string | null;
  role: Role;
  driver_id: string | null;
  is_active: boolean;
  created_at: string;
};
type Driver = { id: string; name: string; is_active: boolean };

const selectClass = "mt-1 block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900";

export default function EmployeesPage({ currentUserId }: { currentUserId: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("dispatcher");
  const [driverId, setDriverId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [employeesResponse, driversResponse] = await Promise.all([
        fetch("/api/employees", { cache: "no-store" }),
        fetch("/api/drivers?all=1", { cache: "no-store" }),
      ]);
      const employeesJson = await employeesResponse.json();
      const driversJson = await driversResponse.json();
      if (!employeesResponse.ok || !driversResponse.ok) {
        throw new Error(employeesJson.error || driversJson.error || "Could not load employees");
      }
      setEmployees(employeesJson.employees ?? []);
      setDrivers(driversJson.drivers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openInvite() {
    setEditId(null);
    setShowInvite(true);
    setEmail("");
    setRole("dispatcher");
    setDriverId("");
    setError(""); setMessage("");
  }

  function openEdit(item: Employee) {
    setShowInvite(false);
    setEditId(item.id);
    setRole(item.role);
    setDriverId(item.driver_id ?? "");
    setError(""); setMessage("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const inviting = showInvite;
      const res = await fetch(inviting ? "/api/employees" : `/api/employees/${editId}`, {
        method: inviting ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(inviting ? { email: email.trim() } : {}), role, driver_id: role === "driver" ? driverId : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save employee");
      setShowInvite(false); setEditId(null);
      setMessage(inviting ? "Invitation sent. The employee can accept by email and choose a password." : "Employee updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save employee");
    } finally { setSaving(false); }
  }

  async function toggle(item: Employee) {
    if (item.is_active && !window.confirm(`Disable ${item.email || "this employee"}? Their app access will be blocked immediately.`)) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const res = await fetch(`/api/employees/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not change employee access");
      setMessage(item.is_active ? "Employee access disabled." : "Employee access enabled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change employee access");
    } finally { setSaving(false); }
  }

  return (
    <PageShell>
      <PageHeader title="Employees" subtitle="Invite team members and control company access. Admin only." action={
        <Button onClick={openInvite}>+ Invite Employee</Button>
      } />

      {error && <p role="alert" className="mb-4 rounded-md bg-white p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-md bg-white p-3 text-sm text-green-700">{message}</p>}

      {(showInvite || editId) && (
        <Card className="mb-5">
          <CardHeader><h2 className="text-sm font-semibold">{showInvite ? "Invite Employee" : "Edit Employee"}</h2></CardHeader>
          <CardContent>
            <form onSubmit={e => void submit(e)} className="max-w-xl space-y-4">
              {showInvite && <label className="block text-sm font-medium text-neutral-700">Employee email
                <Input className="mt-1" type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} placeholder="employee@example.com" />
              </label>}
              <label className="block text-sm font-medium text-neutral-700">Role
                <select className={selectClass} value={role} onChange={e => { setRole(e.target.value as Role); if (e.target.value !== "driver") setDriverId(""); }}>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {role === "driver" && <label className="block text-sm font-medium text-neutral-700">Linked driver
                <select className={selectClass} value={driverId} onChange={e => setDriverId(e.target.value)} required>
                  <option value="">Select driver...</option>
                  {drivers.filter(d => d.is_active && (!employees.some(u => u.role === "driver" && u.driver_id === d.id && u.id !== editId) || d.id === driverId)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <span className="mt-1 block text-xs text-neutral-500">Create the driver record in Drivers first.</span>
              </label>}
              <div className="flex gap-2">
                <Button variant="primary" disabled={saving || (showInvite && !email.trim()) || (role === "driver" && !driverId)} type="submit">
                  {saving ? "Saving..." : showInvite ? "Send Invitation" : "Save Changes"}
                </Button>
                <Button type="button" disabled={saving} onClick={() => { setShowInvite(false); setEditId(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="border-b bg-neutral-50 text-xs uppercase text-neutral-600">
                <tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Driver</th><th className="px-5 py-3">Access</th><th className="px-5 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-800">
                {employees.map(u => <tr key={u.id}>
                  <td className="px-5 py-3">{u.email || "(email not available)"}{u.id === currentUserId ? " (You)" : ""}</td>
                  <td className="px-5 py-3 capitalize">{u.role}</td>
                  <td className="px-5 py-3">{u.driver_id ? drivers.find(d => d.id === u.driver_id)?.name || "Linked driver" : "—"}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-1 text-xs ${u.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-700"}`}>{u.is_active ? "Enabled" : "Disabled"}</span></td>
                  <td className="space-x-2 px-5 py-3">
                    {u.id === currentUserId ? <span className="text-xs text-neutral-400">Self-managed changes blocked</span> : <>
                      <Button disabled={saving} type="button" onClick={() => openEdit(u)}>Edit</Button>
                      <Button disabled={saving} type="button" onClick={() => void toggle(u)}>{u.is_active ? "Disable" : "Enable"}</Button>
                    </>}
                  </td>
                </tr>)}
                {!loading && employees.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-neutral-500">No employees found.</td></tr>}
                {loading && <tr><td colSpan={5} className="px-5 py-8 text-center text-neutral-500">Loading employees...</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <p className="mt-4 text-sm text-white/60">Disabling an employee blocks access to all company APIs. Existing jobs and activity history are preserved.</p>
    </PageShell>
  );
}
