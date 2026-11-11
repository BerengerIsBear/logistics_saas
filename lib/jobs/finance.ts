// Amounts are SGD. Null revenue means the price has not been entered.
export type JobFinancials = {
  revenue: number | null;
  driver_cost: number;
  fuel_cost: number;
  vehicle_cost: number;
  other_cost: number;
};

export function getFinancialTotals(financials: JobFinancials) {
  // Work in cents to prevent floating-point errors such as 0.1 + 0.2.
  const cents = (amount: number) => Math.round(amount * 100);
  const costCents = cents(financials.driver_cost) + cents(financials.fuel_cost) +
    cents(financials.vehicle_cost) + cents(financials.other_cost);
  const revenueCents = financials.revenue === null ? null : cents(financials.revenue);
  const profitCents = revenueCents === null ? null : revenueCents - costCents;

  return {
    total_cost: costCents / 100,
    profit: profitCents === null ? null : profitCents / 100,
    // Margin is undefined when revenue is 0 or hasn't been entered.
    margin: revenueCents === null || revenueCents === 0 || profitCents === null
      ? null
      : Math.round((profitCents / revenueCents) * 10000) / 100,
  };
}
