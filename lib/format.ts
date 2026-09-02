/** 12345 → 12.3k，1234567 → 1.2m */
export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

/** 当前 UTC 日期（YYYY-MM-DD）。GitHub API 与采集任务均按 UTC 计算。 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidDateStr(s: string | undefined | null): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

export function formatDateZh(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCFullYear()} 年 ${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`;
}

/** 今天 / 昨天 / 具体日期 */
export function dateLabel(iso: string): string {
  const t = todayISO();
  if (iso === t) return "今天";
  if (iso === addDaysISO(t, -1)) return "昨天";
  return formatDateZh(iso);
}

/** Next.js searchParams 的值可能是 string | string[] | undefined，取第一个 */
export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
