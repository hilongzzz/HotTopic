import Link from "next/link";
import { cn } from "@/lib/cn";
import { PERIOD_CONFIGS, type PeriodType } from "@/lib/types";

const PERIOD_LIST: PeriodType[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "total",
];

function hrefFor(period: PeriodType, category?: string, date?: string): string {
  const params = new URLSearchParams();
  if (period !== "daily") params.set("period", period);
  if (category) params.set("category", category);
  if (date && period === "daily") params.set("date", date);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function PeriodTabs({
  activePeriod,
  category,
  date,
}: {
  activePeriod: PeriodType;
  category?: string;
  date?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-2">
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface/80 p-1 backdrop-blur">
        {PERIOD_LIST.map((p) => {
          const cfg = PERIOD_CONFIGS[p];
          const isActive = p === activePeriod;
          return (
            <Link
              key={p}
              href={hrefFor(p, category, date)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 sm:text-[13px]",
                isActive
                  ? "bg-accent-strong text-white shadow-sm"
                  : "text-muted hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              {cfg.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
