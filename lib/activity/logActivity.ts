// lib/activity/logActivity.ts

import type { SupabaseClient } from "@supabase/supabase-js";

type LogActivityInput = {
  admin: SupabaseClient;
  companyId: string;
  jobId?: string | null;
  action: string;
  actorUserId: string;
  meta?: Record<string, unknown>;
};

export async function logActivity({
  admin,
  companyId,
  jobId = null,
  action,
  actorUserId,
  meta = {},
}: LogActivityInput) {
  try {
    const { error } = await admin.from("activity").insert({
      company_id: companyId,
      job_id: jobId,
      action,
      actor_user_id: actorUserId,
      meta,
    });

    if (error) {
      console.error("activity insert failed:", error.message);
    }
  } catch (err) {
    console.error("activity insert failed:", err);
  }
}