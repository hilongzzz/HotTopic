import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Category, PeriodType } from "@/lib/types";

const PILL =
  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors";

function hrefFor(period?: PeriodType, date?: string, slug?: string): string {
  const params = new URLSearchParams();
  if (period && period !== "daily") params.set("period", period);
  if (date && (!period || period === "daily")) params.set("date", date);
  if (slug) params.set("category", slug);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function CategoryTabs({
  categories,
  activeSlug,
  period,
  date,
}: {
  categories: Category[];
  activeSlug?: string;
  period?: PeriodType;
  date?: string;
}) {
  return (
    <div className="sticky top-14 z-30 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-2.5">
        <Link
          href={hrefFor(period, date)}
          className={cn(
            PILL,
            !activeSlug
              ? "bg-accent-strong text-white"
              : "text-muted hover:bg-foreground/5",
          )}
        >
          全部
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={hrefFor(period, date, c.slug)}
            className={cn(
              PILL,
              c.slug === activeSlug
                ? "bg-accent-strong text-white"
                : "text-muted hover:bg-foreground/5",
            )}
          >
            {c.emoji} {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
