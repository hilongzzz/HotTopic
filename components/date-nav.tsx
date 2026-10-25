import Link from "next/link";
import {
  addDaysISO,
  dateLabel,
  formatPeriodRange,
  todayISO,
} from "@/lib/format";
import { PERIOD_CONFIGS, type PeriodType } from "@/lib/types";

const NAV_PILL =
  "rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-foreground/80 transition hover:border-accent hover:text-accent-strong";

function hrefFor(period: PeriodType, date: string, category?: string): string {
  const params = new URLSearchParams();
  if (period !== "daily") params.set("period", period);
  params.set("date", date);
  if (category) params.set("category", category);
  return `/?${params.toString()}`;
}

export function DateNav({
  date,
  period = "daily",
  category,
}: {
  date: string;
  period?: PeriodType;
  category?: string;
}) {
  if (period === "total") {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-4">
        <span className="text-xs text-muted">
          📊 依据全网最新 GitHub Star 总量实时排定
        </span>
        <span className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-medium text-muted">
          全周期常驻榜单
        </span>
      </div>
    );
  }

  const today = todayISO();
  const stepDays = PERIOD_CONFIGS[period].days || 1;
  const prevDate = addDaysISO(date, -stepDays);
  const nextDate = addDaysISO(date, stepDays);
  const isLatest = date >= today;

  const prevText = period === "daily" ? "← 前一天" : `← 前一${PERIOD_CONFIGS[period].shortLabel.slice(0, 1)}`;
  const nextText = period === "daily" ? "后一天 →" : `后一${PERIOD_CONFIGS[period].shortLabel.slice(0, 1)} →`;

  return (
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-4">
      <Link href={hrefFor(period, prevDate, category)} className={NAV_PILL}>
        {prevText}
      </Link>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-foreground/80">
          {period === "daily" ? dateLabel(date) : formatPeriodRange(date, period)}
        </span>
        {period !== "daily" && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-strong">
            近 {stepDays} 天
          </span>
        )}
      </div>
      {isLatest ? (
        <span
          className={`${NAV_PILL} cursor-default opacity-40 hover:border-line hover:text-foreground/80`}
        >
          {nextText}
        </span>
      ) : (
        <Link href={hrefFor(period, nextDate, category)} className={NAV_PILL}>
          {nextText}
        </Link>
      )}
    </div>
  );
}
