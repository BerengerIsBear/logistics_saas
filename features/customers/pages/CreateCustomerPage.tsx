// app/(app)/customers/create/page.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function NewCustomerPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => {
    const n = sp.get("next");
    // basic safety: only allow internal paths
    if (n && n.startsWith("/")) return n;
    return "/customers";
  }, [sp]);

  const backHref = next === "/customers" ? "/customers" : next;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const n = name.trim();
    const p = phone.trim();
    const em = email.trim();

    if (!n) {
      setMsg("Name is required");
      return;
    }
    if (em && !looksLikeEmail(em)) {
      setMsg("Invalid email format");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, phone: p, email: em }),
      });

      const json = await res.json();

      if (res.status === 401) throw new Error("Session expired. Please login again.");
      if (!res.ok) throw new Error(json?.error || "Failed to create customer");

      router.push(next);
    } catch (e: any) {
      setMsg(e?.message || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="New Customer"
        subtitle="Add a customer so dispatch can reuse contact details."
        action={
          <Link href={backHref}>
            <Button variant="outline">Back</Button>
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="text-sm font-medium text-neutral-900">Customer details</div>
          <div className="mt-1 text-sm text-neutral-500">Name is required. Phone/email optional.</div>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <div className="mb-1 text-xs text-neutral-500">Name</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ABC Trading"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-neutral-500">Phone</div>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+65 9xxxxxxx"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-neutral-500">Email</div>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@company.com"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="primary" type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Create Customer"}
              </Button>

              <Link href={backHref}>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>

              {msg ? <span className="text-sm text-red-600">{msg}</span> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}

