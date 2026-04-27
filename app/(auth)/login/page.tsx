"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      router.push("/jobs");
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <div className="text-lg font-semibold text-neutral-900">Login</div>
          <div className="mt-1 text-sm text-neutral-500">Email + password.</div>
        </CardHeader>

        <CardContent>
          <form onSubmit={signIn} className="space-y-4">
            <div>
              <div className="text-sm font-medium text-neutral-700">Email</div>
              <div className="mt-1">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-neutral-700">Password</div>
              <div className="mt-1">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            {msg ? <div className="text-sm text-neutral-700">{msg}</div> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


