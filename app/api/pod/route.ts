// app/api/pod/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "pod";
const SIGNED_URL_TTL = 60 * 10; // 10 minutes
const MAX_MB = 10;

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function safeName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_");
}

function normalizeJobNumber(v: string) {
  return v.trim();
}

// Determine type from the bytes, not the browser-supplied MIME or filename.
async function detectPodType(file: File): Promise<{ mime: string; ext: string } | null> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10]
    .every((value, i) => bytes[i] === value)) return { mime: "image/png", ext: "png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 5 && [37, 80, 68, 70, 45]
    .every((value, i) => bytes[i] === value)) return { mime: "application/pdf", ext: "pdf" };
  return null;
}

async function assertJobNumberOwned(companyId: string, jobNumber: string) {
  const { data, error } = await admin
    .from("jobs")
    .select("id, job_number")
    .eq("company_id", companyId)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Invalid jobId (job_number not found)" };
  return { ok: true as const, jobUuid: data.id as string, jobNumber: data.job_number as string };
}

/* ---------------- GET: list PODs ---------------- */
export async function GET(req: Request) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId } = auth.context;

  const { searchParams } = new URL(req.url);
  const raw = String(searchParams.get("jobId") ?? "");
  const jobNumber = normalizeJobNumber(raw);

  if (!jobNumber) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  // ✅ ensure job_number belongs to this company
  const owned = await assertJobNumberOwned(companyId, jobNumber);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: 400 });

  const { data: rows, error } = await admin
    .from("pod_files")
    .select("*")
    .eq("company_id", companyId)
    .eq("job_id", jobNumber) // ✅ stored as JOB-xxxx text
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items: Array<Record<string, unknown>> = [];
  for (const r of rows ?? []) {
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(r.file_path, SIGNED_URL_TTL);

    items.push({ ...r, signedUrl: signErr ? null : signed.signedUrl });
  }

  return NextResponse.json({ items });
}

/* ---------------- POST: upload POD ---------------- */
export async function POST(req: Request) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId, userId } = auth.context;

  const fd = await req.formData();
  const jobNumber = normalizeJobNumber(String(fd.get("jobId") || ""));
  const file = fd.get("file");

  if (!jobNumber) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  // ✅ ensure job_number belongs to this company
  const owned = await assertJobNumberOwned(companyId, jobNumber);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: 400 });

  if (file.size === 0 || file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File must be 1 byte to ${MAX_MB}MB` }, { status: 400 });
  }
  const fileType = await detectPodType(file);
  if (!fileType) {
    return NextResponse.json({ error: "Only JPG, PNG or PDF proof files are allowed" }, { status: 400 });
  }

  const filename = safeName(file.name).slice(0, 180) || `proof.${fileType.ext}`;
  const ext = fileType.ext;

  // ✅ keep path consistent with existing rows (jobNumber)
  const filePath = `companies/${companyId}/jobs/${jobNumber}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await admin.storage.from(BUCKET).upload(filePath, file, {
    contentType: fileType.mime,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: row, error: insErr } = await admin
    .from("pod_files")
    .insert({
      company_id: companyId,
      job_id: jobNumber, // ✅ stored as job_number text
      file_name: filename,
      file_path: filePath,
      mime_type: fileType.mime,
      size: file.size,
    })
    .select("*")
    .single();

  if (insErr) {
    // Don't leave an untracked file behind when the database insert fails.
    await admin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: "Could not save proof file record" }, { status: 500 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL);

  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 });

  // ✅ Activity log (non-blocking)
  // IMPORTANT: your Activity UI expects job UUID in /api/activity
  // So we log BOTH: job_number in meta + use job UUID as job_id if your activity table expects UUID.
  try {
    const { error: actErr } = await admin.from("activity").insert({
      company_id: companyId,
      job_id: owned.jobUuid, // ✅ activity should use UUID
      action: "pod.uploaded",
      actor_user_id: userId,
      meta: {
        job_number: jobNumber,
        pod_id: row.id,
        file_name: row.file_name,
        file_path: row.file_path,
        mime_type: row.mime_type,
        size: row.size,
      },
    });
    if (actErr) console.error("activity insert failed:", actErr.message);
  } catch (e) {
    console.error("activity insert failed:", e);
  }

  return NextResponse.json({ item: { ...row, signedUrl: signed.signedUrl } });
}

/* ---------------- DELETE: remove POD ---------------- */
export async function DELETE(req: Request) {
  const auth = await requireRole(["admin", "dispatcher"]);
  if ("response" in auth) return auth.response;
  const { companyId, userId } = auth.context;

  const body = await req.json().catch(() => null);
  const podId = String(body?.podId ?? "").trim();
  if (!podId) return NextResponse.json({ error: "podId required" }, { status: 400 });

  const { data: row, error: getErr } = await admin
    .from("pod_files")
    .select("*")
    .eq("id", podId)
    .eq("company_id", companyId)
    .single();

  if (getErr || !row) return NextResponse.json({ error: "POD not found" }, { status: 404 });

  const jobNumber = String(row.job_id ?? "").trim();
  if (!jobNumber) return NextResponse.json({ error: "Invalid POD link" }, { status: 400 });

  // ✅ ensure job_number belongs to this company
  const owned = await assertJobNumberOwned(companyId, jobNumber);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: 400 });

  const { error: rmErr } = await admin.storage.from(BUCKET).remove([row.file_path]);
  if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 500 });

  const { error: delErr } = await admin.from("pod_files").delete().eq("id", podId).eq("company_id", companyId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // ✅ Activity log (non-blocking)
  try {
    const { error: actErr } = await admin.from("activity").insert({
      company_id: companyId,
      job_id: owned.jobUuid, // ✅ activity should use UUID
      action: "pod.deleted",
      actor_user_id: userId,
      meta: {
        job_number: jobNumber,
        pod_id: row.id,
        file_name: row.file_name,
        file_path: row.file_path,
        mime_type: row.mime_type,
        size: row.size,
      },
    });
    if (actErr) console.error("activity insert failed:", actErr.message);
  } catch (e) {
    console.error("activity insert failed:", e);
  }

  return NextResponse.json({ ok: true });
}

