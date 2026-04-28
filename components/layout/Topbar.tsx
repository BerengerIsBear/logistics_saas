// components/layout/Topbar.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function Topbar() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("Loading...");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = supabaseBrowser();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email ?? "Not logged in");
    }

    loadUser();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    const supabase = supabaseBrowser();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div>
        <div className="text-sm font-semibold text-neutral-900">
          Logistics Ops
        </div>
        <div className="text-xs text-neutral-500">
          Logged in as {email}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "Logging out..." : "Logout"}
      </Button>
    </header>
  );
}