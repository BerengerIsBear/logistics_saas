"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function accept() {
      try {
        const client = supabaseBrowser();
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.slice(1));
        const token = hash.get("access_token");
        const refresh = hash.get("refresh_token");
        const code = url.searchParams.get("code");
        if (url.searchParams.get("error")) throw new Error(url.searchParams.get("error_description") || "Invitation link invalid or expired");
        if (token && refresh) {
          const { error } = await client.auth.setSession({ access_token: token, refresh_token: refresh });
          if (error) throw error;
        } else if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        // Remove token fragments/query immediately after establishing the session.
        window.history.replaceState(null, "", "/accept-invite");
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) throw new Error("Please open the invitation email link again. It may have expired.");
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not accept invitation");
      }
    }
    void accept();
  }, []);

  async function finish(e: FormEvent) {
    e.preventDefault(); setError("");
    if (password.length < 8) { setError("Choose a password with at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) throw error;
      const res = await fetch("/api/me/company", { cache: "no-store" });
      if (!res.ok) throw new Error("Password set, but company access is not ready. Ask your admin to check the employee profile.");
      const data = await res.json();
      router.replace(data.role === "driver" ? "/driver-jobs" : "/jobs");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password");
    } finally { setSaving(false); }
  }

  return <main className="flex min-h-screen items-center justify-center px-4 py-8">
    <Card className="w-full max-w-md">
      <CardHeader><h1 className="text-xl font-semibold">Accept Employee Invitation</h1><p className="mt-1 text-sm text-neutral-500">Set your password to finish joining your company.</p></CardHeader>
      <CardContent>
        {!ready && !error && <p className="text-sm text-neutral-600">Checking invitation...</p>}
        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        {ready && <form onSubmit={e => void finish(e)} className="space-y-4">
          <label className="block text-sm">Password (at least 8 characters)<Input className="mt-1" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
          <label className="block text-sm">Confirm password<Input className="mt-1" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? "Setting password..." : "Finish Setup"}</Button>
        </form>}
      </CardContent>
    </Card>
  </main>;
}
