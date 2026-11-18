// Read-only security checks for two *different* test companies.
// Requires two test Admin accounts, each assigned to a different company.
// No service-role key is used by this script.
import nextEnv from '@next/env';
import { createServerClient } from '@supabase/ssr';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const baseUrl = (process.env.TEST_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const required = ['TEST_A_EMAIL', 'TEST_A_PASSWORD', 'TEST_B_EMAIL', 'TEST_B_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (!supabaseUrl || !anonKey || missing.length) {
  console.error(`Missing Supabase public env vars or test credentials: ${missing.join(', ') || 'NEXT_PUBLIC_SUPABASE_*'}`);
  process.exit(1);
}

let passed = 0, failed = 0, skipped = 0;
function pass(message) { passed++; console.log(`  PASS  ${message}`); }
function fail(message) { failed++; console.log(`  FAIL  ${message}`); }
function skip(message) { skipped++; console.log(`  SKIP  ${message}`); }
function requireResult(condition, message) { condition ? pass(message) : fail(message); }

// A Supabase SSR session saves cookies exactly as our Next.js API expects.
async function signIn(label, email, password) {
  const jar = new Map();
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const { name, value } of items) {
          if (!value) jar.delete(name);
          else jar.set(name, value);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label}: sign-in failed (${error.message})`);
  return { label, client, jar, companyId: null, role: null };
}

async function get(account, path, asText = false) {
  const cookieHeader = [...account.jar].map(([name, value]) => `${name}=${value}`).join('; ');
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: cookieHeader, Accept: asText ? 'text/csv' : 'application/json' },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  const value = asText ? await response.text() : await response.json().catch(() => null);
  return { status: response.status, value };
}

async function getOk(account, path, label) {
  const result = await get(account, path);
  requireResult(result.status === 200, `${account.label}: ${label} returns HTTP 200 (got ${result.status})`);
  return result.status === 200 ? result.value : null;
}

function items(data, key) { return Array.isArray(data?.[key]) ? data[key] : null; }
function assertOwned(rows, companyId, label) {
  if (!rows) return fail(`${label}: expected a list of records`);
  requireResult(rows.every((row) => row.company_id === companyId), `${label}: every row belongs to the signed-in company`);
}
function assertSeparateIds(a, b, label) {
  if (!a || !b) return;
  const ids = new Set(a.map((r) => r.id));
  requireResult(b.every((r) => !ids.has(r.id)), `${label}: no record IDs shared across companies`);
}
function containsMarker(value, marker) {
  return JSON.stringify(value ?? '').toLowerCase().includes(marker.toLowerCase());
}

console.log(`\nCompany isolation security test (READ ONLY) — ${baseUrl}`);
console.log('Use separate test companies and test accounts. No business data is changed.\n');

try {
  const A = await signIn('Company A', process.env.TEST_A_EMAIL, process.env.TEST_A_PASSWORD);
  const B = await signIn('Company B', process.env.TEST_B_EMAIL, process.env.TEST_B_PASSWORD);
  for (const account of [A, B]) {
    const me = await getOk(account, '/api/me/company', 'company identity');
    if (!me?.companyId || me?.role !== 'admin') {
      throw new Error(`${account.label} must be an active Admin with a company profile.`);
    }
    account.companyId = me.companyId;
    account.role = me.role;
  }
  if (A.companyId === B.companyId) {
    throw new Error('Both accounts belong to the SAME company. Create a separate Company B before testing.');
  }
  pass('Two authenticated Admin accounts have different company IDs');

  // Verify row scoping and record identity separation on every primary list.
  const lists = [
    ['/api/jobs', 'jobs', 'Jobs'],
    ['/api/customers', 'customers', 'Customers'],
    ['/api/drivers?all=1', 'drivers', 'Drivers'],
    ['/api/vehicles?all=1', 'vehicles', 'Vehicles'],
    ['/api/workflows', 'templates', 'Workflows'],
    ['/api/employees', 'employees', 'Employees'],
    ['/api/workflow-escalations', 'rows', 'Escalations'],
  ];
  const cache = new Map();
  for (const [path, key, label] of lists) {
    const a = await getOk(A, path, label);
    const b = await getOk(B, path, label);
    if (!a || !b) continue;
    const aRows = items(a, key), bRows = items(b, key);
    if (!aRows || !bRows) { fail(`${label}: missing '${key}' array`); continue; }
    cache.set(label, { a: aRows, b: bRows });
    // Jobs and Customers return company_id; Drivers/Vehicles deliberately omit it.
    if (['Jobs', 'Customers'].includes(label)) {
      assertOwned(aRows, A.companyId, `Company A / ${label}`);
      assertOwned(bRows, B.companyId, `Company B / ${label}`);
    }
    assertSeparateIds(aRows, bRows, label);
  }

  // An ID-only query must not disclose a foreign tenant's job. Job numbers
  // are not globally unique: if both companies have JOB-1001, the response
  // may legitimately return the requester's own JOB-1001 instead of 404.
  const aJobs = cache.get('Jobs')?.a ?? [];
  const bJobs = cache.get('Jobs')?.b ?? [];
  for (const [account, foreignJobs] of [[A, bJobs], [B, aJobs]]) {
    const foreign = foreignJobs[0];
    if (!foreign) { skip(`${account.label}: other company has no job for foreign-job probe`); continue; }
    const jobNumber = encodeURIComponent(foreign.job_number);
    const result = await get(account, `/api/jobs/${jobNumber}`);
    requireResult(result.status === 404 ||
      (result.status === 200 && result.value?.job?.company_id === account.companyId && result.value?.job?.id !== foreign.id),
    `${account.label}: foreign job number cannot reveal the foreign job (status ${result.status})`);
    const foreignOnly = !(account === A ? aJobs : bJobs).some((j) => j.job_number === foreign.job_number);
    if (foreignOnly) {
      for (const [path, name, allowedStatuses] of [
        [`/api/jobs/${jobNumber}/financials`, 'Financial record', [404]],
        [`/api/jobs/${jobNumber}/workflow`, 'Workflow record', [404]],
        [`/api/pod?jobId=${jobNumber}`, 'POD record', [400, 404]],
      ]) {
        const reply = await get(account, path);
        requireResult(allowedStatuses.includes(reply.status),
          `${account.label}: foreign ${name} denied (status ${reply.status})`);
      }
    } else {
      skip(`${account.label}: job numbers overlap; ID-only checks for financials/workflow/POD are ambiguous`);
    }
  }

  // The application may return aggregate metrics with no company_id field.
  // Distinct Company B sample customer names let us detect obvious leaks there.
  const marker = (process.env.TEST_B_MARKER || '').trim();
  const summaries = [
    '/api/analytics/driver-performance',
    '/api/analytics/sla-performance',
    '/api/analytics/operational-risk',
    '/api/analytics/profit-risk',
    '/api/analytics/customer-profitability',
    '/api/reports?report=operations',
    '/api/reports?report=drivers',
    '/api/reports?report=financial',
    '/api/reports?report=customers',
  ];
  for (const path of summaries) {
    const reply = await getOk(A, path, path);
    if (reply && marker) {
      requireResult(!containsMarker(reply, marker), `${path}: Company B sample marker is absent`);
    }
  }
  if (!marker) skip('Set TEST_B_MARKER to your unique Company B customer name for aggregate-data leak checks');
  if (marker) {
    const bCustomers = cache.get('Customers')?.b ?? [];
    requireResult(bCustomers.some((row) => containsMarker(row, marker)),
      'TEST_B_MARKER actually exists in Company B (avoid a meaningless test)');
    requireResult(!(cache.get('Customers')?.a ?? []).some((row) => containsMarker(row, marker)),
      'TEST_B_MARKER is absent from Company A customers');
    for (const path of ['/api/reports?report=operations&format=csv', '/api/reports?report=customers&format=csv']) {
      const reply = await get(A, path, true);
      requireResult(reply.status === 200 && !containsMarker(reply.value, marker),
        `${path}: Company B marker absent from CSV`);
    }
  }

  // Direct browser-key database reads MUST be blocked by the Phase 1 SQL.
  // This test deliberately never uses the server's service-role key.
  const tables = [
    'companies', 'profiles', 'jobs', 'customers', 'drivers', 'vehicles',
    'pod_files', 'activity', 'job_financials', 'workflow_templates',
    'job_workflows', 'workflow_escalations',
  ];
  for (const table of tables) {
    const result = await A.client.from(table).select('*').limit(1);
    requireResult(Boolean(result.error), `Direct authenticated client SELECT from '${table}' is denied`);
  }

  // Optional Storage leak check if the other tenant has proof uploads.
  const foreignBJob = bJobs.find((j) => !aJobs.some((a) => a.job_number === j.job_number));
  if (foreignBJob) {
    const result = await get(B, `/api/pod?jobId=${encodeURIComponent(foreignBJob.job_number)}`);
    if (result.status === 200 && (result.value?.items?.length ?? 0) > 0) {
      const foreignPath = result.value.items[0].file_path;
      const { data, error } = await A.client.storage.from('pod').download(foreignPath);
      requireResult(Boolean(error) && !data, 'Company A cannot directly download a Company B POD file');
    } else {
      skip('Company B has no POD on a uniquely numbered job; Storage cross-tenant download not checked');
    }
  } else {
    skip('No uniquely numbered Company B job; Storage cross-tenant download not checked');
  }
} catch (error) {
  fail(error.message || String(error));
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
console.log('This is a READ-ONLY security check; mutation, concurrency, and penetration tests are separate tasks.');
process.exitCode = failed ? 1 : 0;
