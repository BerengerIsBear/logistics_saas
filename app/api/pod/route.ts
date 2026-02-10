// app/api/pod/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "pod";
const SIGNED_URL_TTL = 60 * 10; // 10 minutes
const MAX_MB = 10;

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function getCompanyId(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (error || !data?.company_id) return null;
  return data.company_id as string;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_");
}

/* ---------------- GET: list PODs ---------------- */
export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const { data: rows, error } = await admin
    .from("pod_files")
    .select("*")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = [];
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
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const fd = await req.formData();
  const jobId = String(fd.get("jobId") || "");
  const file = fd.get("file");

  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_MB) {
    return NextResponse.json({ error: `Max file size is ${MAX_MB}MB` }, { status: 400 });
  }

  const filename = safeName(file.name);
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";

  // isolate by company as well
  const filePath = `companies/${companyId}/jobs/${jobId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await admin.storage.from(BUCKET).upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: row, error: insErr } = await admin
    .from("pod_files")
    .insert({
      company_id: companyId,
      job_id: jobId,
      file_name: filename,
      file_path: filePath,
      mime_type: file.type,
      size: file.size,
    })
    .select("*")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL);

  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 });

  return NextResponse.json({ item: { ...row, signedUrl: signed.signedUrl } });
}

/* ---------------- DELETE: remove POD ---------------- */
export async function DELETE(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = await getCompanyId(user.id);
  if (!companyId) return NextResponse.json({ error: "No company profile" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const podId = body?.podId as string | undefined;
  if (!podId) return NextResponse.json({ error: "podId required" }, { status: 400 });

  const { data: row, error: getErr } = await admin
    .from("pod_files")
    .select("*")
    .eq("id", podId)
    .eq("company_id", companyId)
    .single();

  if (getErr || !row) return NextResponse.json({ error: "POD not found" }, { status: 404 });

  const { error: rmErr } = await admin.storage.from(BUCKET).remove([row.file_path]);
  if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 500 });

  const { error: delErr } = await admin.from("pod_files").delete().eq("id", podId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
