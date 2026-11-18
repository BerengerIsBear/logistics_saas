// Employee access & API authorization smoke tests for this Next.js/Supabase app.
// Test requests use GET or deliberately invalid write payloads; no valid changes are sent.
// Use test accounts only. Run with Node 20+ and an ignored local .env file.
import nextEnv from '@next/env';
import { createServerClient } from '@supabase/ssr';

nextEnv.loadEnvConfig(process.cwd());

const appUrl = (process.env.TEST_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const disabledMode = process.argv.includes('--disabled');
const adminEmail = process.env.TEST_A_EMAIL;
const adminPassword = process.env.TEST_A_PASSWORD;
const dispatcherEmail = process.env.TEST_DISPATCHER_EMAIL;
const dispatcherPassword = process.env.TEST_DISPATCHER_PASSWORD;
const driverEmail = process.env.TEST_DRIVER_EMAIL;
const driverPassword = process.env.TEST_DRIVER_PASSWORD;

if (!supabaseUrl || !anonKey || !adminEmail || !adminPassword) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_* or TEST_A_EMAIL / TEST_A_PASSWORD.');
  process.exit(1);
}
if (disabledMode && (!dispatcherEmail || !dispatcherPassword)) {
  console.error('--disabled requires TEST_DISPATCHER_EMAIL and TEST_DISPATCHER_PASSWORD.');
  process.exit(1);
}

let passCount = 0, failCount = 0, skipCount = 0;
const pass = (label) => { passCount++; console.log(`  PASS  ${label}`); };
const fail = (label) => { failCount++; console.log(`  FAIL  ${label}`); };
const skip = (label) => { skipCount++; console.log(`  SKIP  ${label}`); };
const expect = (condition, label) => condition ? pass(label) : fail(label);
const asArray = (value) => Array.isArray(value) ? value : [];

// Supabase SSR writes the same cookies that the real browser app uses.
async function signIn(email, password) {
  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const { name, value } of items) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed (${error.message}). Check the test account credentials.`);
  return { jar };
}

async function request(account, path, { method = 'GET', body, origin } = {}) {
  const headers = { Accept: 'application/json' };
  if (account) {
    headers.Cookie = [...account.jar].map(([name, value]) => `${name}=${value}`).join('; ');
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (origin !== undefined) headers.Origin = origin;

  const res = await fetch(`${appUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  const contentType = res.headers.get('content-type') || '';
  const value = contentType.includes('application/json') ? await res.json().catch(() => null) : null;
  return { status: res.status, value };
}

async function expectCode(account, path, expected, label, options) {
  const result = await request(account, path, options);
  expect(result.status === expected, `${label}: HTTP ${result.status} (expected ${expected})`);
  return result;
}

async function getIdentity(account, label, role) {
  const res = await expectCode(account, '/api/me/company', 200, `${label} identity`);
  if (res.status !== 200) return null;
  expect(res.value?.role === role && Boolean(res.value?.companyId),
    `${label} has active ${role} role and company`);
  return res.value;
}

console.log(`\nEmployee & API security check (${disabledMode ? 'DISABLED account' : 'NORMAL'}) — ${appUrl}`);
console.log('GET checks plus invalid-body/blocked-origin probes. No valid write payloads.\n');

try {
  const admin = await signIn(adminEmail, adminPassword);
  const adminIdentity = await getIdentity(admin, 'Admin', 'admin');
  if (!adminIdentity || adminIdentity.role !== 'admin') throw new Error('TEST_A_EMAIL must be an active Admin.');

  if (!disabledMode) {
    // Anonymous users must never read protected APIs.
    for (const path of ['/api/me/company', '/api/jobs', '/api/employees', '/api/reports?report=financial']) {
      await expectCode(null, path, 401, `Anonymous ${path}`);
    }

    // Admin is able to use the main management endpoints.
    for (const path of ['/api/jobs', '/api/employees', '/api/reports?report=financial']) {
      await expectCode(admin, path, 200, `Admin ${path}`);
    }
    await expectCode(admin, '/api/driver-jobs?scope=today', 403, 'Admin cannot use driver-only job API');

    // Invalid origin: blocked before employee invitation logic is reached.
    // Empty body is intentionally NOT a valid invitation, even if a guard is broken.
    await expectCode(admin, '/api/employees', 403, 'Admin foreign-origin invitation blocked', {
      method: 'POST', body: {}, origin: 'https://security-test.invalid',
    });

    if (!dispatcherEmail || !dispatcherPassword) {
      skip('Dispatcher checks: add TEST_DISPATCHER_EMAIL / TEST_DISPATCHER_PASSWORD');
    } else {
      const dispatcher = await signIn(dispatcherEmail, dispatcherPassword);
      const dispatcherIdentity = await getIdentity(dispatcher, 'Dispatcher', 'dispatcher');
      if (dispatcherIdentity?.role === 'dispatcher') {
        for (const path of ['/api/jobs', '/api/reports?report=operations']) {
          await expectCode(dispatcher, path, 200, `Dispatcher ${path}`);
        }
        for (const path of [
          '/api/employees',
          '/api/reports?report=financial',
          '/api/reports?report=customers',
          '/api/reports?report=financial&format=csv',
          '/api/analytics/customer-profitability',
          '/api/analytics/profit-risk',
          '/api/driver-jobs?scope=today',
        ]) {
          await expectCode(dispatcher, path, 403, `Dispatcher denied ${path}`);
        }
        // Role guard must execute before validation. No employee can be created with {}.
        await expectCode(dispatcher, '/api/employees', 403, 'Dispatcher cannot invite employees', {
          method: 'POST', body: {}, origin: new URL(appUrl).origin,
        });
        await expectCode(dispatcher, '/api/employees/not-a-uuid', 403, 'Dispatcher cannot edit employees', {
          method: 'PATCH', body: {}, origin: new URL(appUrl).origin,
        });
      }
    }

    if (!driverEmail || !driverPassword) {
      skip('Driver checks: add TEST_DRIVER_EMAIL / TEST_DRIVER_PASSWORD');
    } else {
      const driver = await signIn(driverEmail, driverPassword);
      const driverIdentity = await getIdentity(driver, 'Driver', 'driver');
      if (driverIdentity?.role === 'driver') {
        for (const path of [
          '/api/jobs', '/api/customers', '/api/employees',
          '/api/reports?report=operations', '/api/reports?report=financial',
          '/api/analytics/driver-performance', '/api/workflows',
        ]) {
          await expectCode(driver, path, 403, `Driver denied ${path}`);
        }
        // No job is created because the payload is missing required fields.
        await expectCode(driver, '/api/jobs', 403, 'Driver cannot create jobs', {
          method: 'POST', body: {}, origin: new URL(appUrl).origin,
        });
        for (const scope of ['today', 'upcoming']) {
          const path = `/api/driver-jobs?scope=${scope}`;
          const res = await expectCode(driver, path, 200, `Driver ${path}`);
          if (res.status === 200 && Array.isArray(res.value?.jobs)) {
            const employeesResult = await request(admin, '/api/employees');
            const linked = asArray(employeesResult.value?.employees)
              .find((e) => e.email?.toLowerCase() === driverEmail.toLowerCase());
            if (linked?.driver_id && driverIdentity.companyId === adminIdentity.companyId) {
              expect(res.value.jobs.every((job) =>
                job.driver_id === linked.driver_id && job.company_id === driverIdentity.companyId),
                `Driver ${scope} jobs belong only to linked driver`);
            } else {
              skip(`Driver ${scope} assignment check: driver must belong to Admin's company and be linked`);
            }
          }
        }
      }
    }
  } else {
    // Before running --disabled, the Admin must manually DISABLE the test Dispatcher in Employees.
    // The same Supabase Auth user may sign in, but app APIs must reject them immediately.
    const disabledUser = await signIn(dispatcherEmail, dispatcherPassword);
    const list = await request(admin, '/api/employees');
    const employee = asArray(list.value?.employees)
      .find((row) => row.email?.toLowerCase() === dispatcherEmail.toLowerCase());
    if (employee) expect(employee.is_active === false, 'Admin sees test employee as disabled');
    else skip('Disabled employee not listed under Admin company; cannot verify is_active');

    for (const path of [
      '/api/me/company', '/api/jobs', '/api/employees',
      '/api/reports?report=operations', '/api/reports?report=financial',
      '/api/driver-jobs?scope=today',
    ]) {
      await expectCode(disabledUser, path, 403, `Disabled employee denied ${path}`);
    }
    await expectCode(disabledUser, '/api/jobs', 403, 'Disabled employee cannot create jobs', {
      method: 'POST', body: {}, origin: new URL(appUrl).origin,
    });
  }
} catch (error) {
  fail(error.message || String(error));
}

console.log(`\nRESULT: ${passCount} passed, ${failCount} failed, ${skipCount} skipped.`);
console.log('Role/disabled API smoke checks are not a penetration test; use disposable accounts.');
process.exitCode = failCount ? 1 : 0;
