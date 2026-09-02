import Link from "next/link";
import { addDaysISO, dateLabel, todayISO } from "@/lib/format";

const NAV_PILL =
  "rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-foreground/80 transition hover:border-accent hover:text-accent-strong";

function hrefFor(date: string, category?: string): string {
  const params = new URLSearchParams({ date });
  if (category) params.set("category", category);
  return `/?${params.toString()}`;
}

export function DateNav({ date, category }: { date: string; category?: string }) {
  const today = todayISO();
  const prev = addDaysISO(date, -1);
  const isLatest = date >= today;

  return (
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-4">
      <Link href={hrefFor(prev, category)} className={NAV_PILL}>
        ← 前一天
      </Link>
      <span className="text-sm font-medium tabular-nums text-foreground/70">
        {dateLabel(date)}
      </span>
      {isLatest ? (
        <span className={`${NAV_PILL} cursor-default opacity-40 hover:border-line hover:text-foreground/80`}>
          后一天 →
        </span>
      ) : (
        <Link href={hrefFor(addDaysISO(date, 1), category)} className={NAV_PILL}>
          后一天 →
        </Link>
      )}
    </div>
  );
}
