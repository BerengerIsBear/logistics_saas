import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "pod";
const SIGNED_URL_TTL = 60 * 10; // 10 min
const MAX_MB = 10;

function safeName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("pod_files")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = [];
  for (const row of data ?? []) {
    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, SIGNED_URL_TTL);

    items.push({ ...row, signedUrl: signErr ? null : signed.signedUrl });
  }

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const sb = supabaseAdmin();
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
  const path = `jobs/${jobId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: row, error: insErr } = await sb
    .from("pod_files")
    .insert({
      job_id: jobId,
      file_name: filename,
      file_path: path,
      mime_type: file.type,
      size: file.size,
    })
    .select("*")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const { data: signed, error: signErr } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 });

  return NextResponse.json({ item: { ...row, signedUrl: signed.signedUrl } });
}

export async function DELETE(req: Request) {
  const sb = supabaseAdmin();
  const body = await req.json().catch(() => null);

  const podId = body?.podId as string | undefined;
  if (!podId) return NextResponse.json({ error: "podId required" }, { status: 400 });

  const { data: row, error: getErr } = await sb
    .from("pod_files")
    .select("*")
    .eq("id", podId)
    .single();

  if (getErr || !row) return NextResponse.json({ error: "POD not found" }, { status: 404 });

  const { error: rmErr } = await sb.storage.from(BUCKET).remove([row.file_path]);
  if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 500 });

  const { error: delErr } = await sb.from("pod_files").delete().eq("id", podId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
