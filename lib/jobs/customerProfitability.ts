// Simple admin-only reporting calculations. All money is SGD.
// A job counts towards profit only after its revenue has been entered.
export type CustomerRecord = { id: string; name: string };
export type JobRecord = { id: string; customer_id: string | null; customer: string | null };
export type FinancialRecord = {
  job_id: string;
  revenue: number | string | null;
  driver_cost: number | string;
  fuel_cost: number | string;
  vehicle_cost: number | string;
  other_cost: number | string;
};

export type CustomerProfitRow = {
  customer_id: string;
  name: string;
  job_count: number;
  priced_jobs: number;
  missing_revenue_jobs: number;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  margin: number | null;
  loss_jobs: number;
};

function margin(revenueCents: number, profitCents: number): number | null {
  return revenueCents === 0 ? null : Math.round((profitCents / revenueCents) * 10000) / 100;
}

// Use whole cents to avoid floating-point drift in totals.
function cents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function buildCustomerProfitability(
  customers: CustomerRecord[],
  jobs: JobRecord[],
  financials: FinancialRecord[]
) {
  const customerNames = new Map(customers.map(c => [c.id, c.name]));
  const financesByJob = new Map(financials.map(f => [f.job_id, f]));
  type Aggregate = {
    customer_id: string;
    name: string;
    job_count: number;
    priced_jobs: number;
    loss_jobs: number;
    revenueCents: number;
    costCents: number;
  };
  const grouped = new Map<string, Aggregate>();

  for (const job of jobs) {
    // Legacy jobs without a customer ID are kept separate, not silently omitted.
    const snapshot = (job.customer || "Unknown").trim() || "Unknown";
    const key = job.customer_id ?? `legacy:${snapshot.toLowerCase()}`;
    const name = job.customer_id
      ? (customerNames.get(job.customer_id) ?? snapshot)
      : `Unlinked: ${snapshot}`;
    let group = grouped.get(key);
    if (!group) {
      group = {
        customer_id: key, name, job_count: 0, priced_jobs: 0,
        loss_jobs: 0, revenueCents: 0, costCents: 0,
      };
      grouped.set(key, group);
    }
    group.job_count += 1;

    const financial = financesByJob.get(job.id);
    // Unknown revenue is NOT $0. Costs on unpriced jobs are excluded from
    // these profit totals until revenue is supplied.
    if (!financial || financial.revenue === null) continue;

    const revenueCents = cents(financial.revenue);
    const costCents = cents(financial.driver_cost) + cents(financial.fuel_cost) +
      cents(financial.vehicle_cost) + cents(financial.other_cost);
    group.priced_jobs += 1;
    group.revenueCents += revenueCents;
    group.costCents += costCents;
    if (revenueCents < costCents) group.loss_jobs += 1;
  }

  const rows: CustomerProfitRow[] = [...grouped.values()].map(g => {
    const hasPrices = g.priced_jobs > 0;
    const profitCents = g.revenueCents - g.costCents;
    return {
      customer_id: g.customer_id,
      name: g.name,
      job_count: g.job_count,
      priced_jobs: g.priced_jobs,
      missing_revenue_jobs: g.job_count - g.priced_jobs,
      revenue: hasPrices ? g.revenueCents / 100 : null,
      cost: hasPrices ? g.costCents / 100 : null,
      profit: hasPrices ? profitCents / 100 : null,
      margin: hasPrices ? margin(g.revenueCents, profitCents) : null,
      loss_jobs: g.loss_jobs,
    };
  });

  // Highlight unprofitable customers first; those with no revenue at the bottom.
  rows.sort((a, b) => (a.profit ?? Infinity) - (b.profit ?? Infinity) || a.name.localeCompare(b.name));

  const priced = rows.filter(r => r.priced_jobs > 0);
  const revenueCents = priced.reduce((sum, r) => sum + cents(r.revenue ?? 0), 0);
  const costCents = priced.reduce((sum, r) => sum + cents(r.cost ?? 0), 0);
  const profitCents = revenueCents - costCents;
  const pricedJobs = priced.reduce((sum, r) => sum + r.priced_jobs, 0);
  return {
    rows,
    summary: {
      customers: rows.length,
      jobs: jobs.length,
      priced_jobs: pricedJobs,
      missing_revenue_jobs: jobs.length - pricedJobs,
      loss_jobs: rows.reduce((sum, r) => sum + r.loss_jobs, 0),
      revenue: pricedJobs ? revenueCents / 100 : null,
      cost: pricedJobs ? costCents / 100 : null,
      profit: pricedJobs ? profitCents / 100 : null,
      margin: pricedJobs ? margin(revenueCents, profitCents) : null,
    },
  };
}
