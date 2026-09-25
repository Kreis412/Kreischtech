// Date-only periods use exclusive ends; YTD comparisons stop at matching calendar dates.
export function reportingPeriod(year, period, today) {
  const next = day => new Date(Date.parse(day + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const sameDay = y => {
    const month = Number(today.slice(5, 7));
    const last = new Date(Date.UTC(y, month, 0)).getUTCDate();
    return `${y}-${today.slice(5, 7)}-${String(Math.min(Number(today.slice(8, 10)), last)).padStart(2, '0')}`;
  };
  const range = y => {
    if (period === 'ytd') return { start: `${y}-01-01`, end: next(sameDay(y)) };
    const month = period === 'all' ? 1 : (Number(period) - 1) * 3 + 1;
    const after = period === 'all' ? 13 : month + 3;
    return { start: `${y}-${String(month).padStart(2, '0')}-01`, end: after === 13 ? `${y + 1}-01-01` : `${y}-${String(after).padStart(2, '0')}-01` };
  };
  return { ...range(year), previous: range(year - 1) };
}

export function estimateReturn(cost, selling, gaps = 0) {
  const profit = selling == null ? null : selling - cost;
  return { profit_cents: profit, return_percent: profit === null || cost <= 0 ? null : profit / cost * 100,
    margin_percent: profit === null || selling <= 0 ? null : profit / selling * 100, provisional: gaps > 0 };
}
