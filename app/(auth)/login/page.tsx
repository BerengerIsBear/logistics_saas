// app/(auth)/login/page.tsx

"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "reset">("login");

  const [email, setEmail] = useState("berengerngan@gmail.com");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSessionReady, setResetSessionReady] = useState(false);

  useEffect(() => {
    async function handlePasswordRecoverySession() {
      const hash = window.location.hash;

      if (!hash.includes("access_token")) {
        return;
      }

      setMode("reset");
      setMsg("Preparing reset session...");

      const params = new URLSearchParams(hash.replace("#", ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        setMsg("Reset link is invalid. Please resend password recovery.");
        return;
      }

      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      setResetSessionReady(true);
      setMsg("");

      window.history.replaceState(null, "", "/login");
    }

    handlePasswordRecoverySession();
  }, []);

  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMsg("");
    setLoading(true);

    try {
      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      router.replace("/jobs");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(err.message);
      } else {
        setMsg("Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMsg("");
    setLoading(true);

    try {
      if (!resetSessionReady) {
        throw new Error("Reset session is not ready. Please resend password recovery.");
      }

      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setMsg("Password updated successfully. Redirecting...");

      router.replace("/jobs");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(err.message);
      } else {
        setMsg("Password update failed");
      }
    } finally {
      setLoading(false);
    }
  }

  if (mode === "reset") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white text-neutral-900">
          <CardHeader>
            <div className="text-lg font-semibold text-neutral-900">
              Reset Password
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Enter your new password.
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={updatePassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">
                  New password
                </label>

                <div className="mt-1">
                  <Input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <Button
                variant="primary"
                type="submit"
                disabled={loading || !resetSessionReady}
              >
                {loading ? "Updating..." : "Update password"}
              </Button>

              {msg ? (
                <div className="text-sm text-neutral-700">{msg}</div>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md bg-white text-neutral-900">
        <CardHeader>
          <div className="text-lg font-semibold text-neutral-900">Login</div>
          <div className="mt-1 text-sm text-neutral-500">
            Sign in with your email and password.
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">
                Email
              </label>

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
              <label className="text-sm font-medium text-neutral-700">
                Password
              </label>

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

            {msg ? <div className="text-sm text-red-600">{msg}</div> : null}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}