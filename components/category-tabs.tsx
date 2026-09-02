import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Category } from "@/lib/types";

const PILL =
  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors";

function hrefFor(date: string | undefined, slug?: string): string {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (slug) params.set("category", slug);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function CategoryTabs({
  categories,
  activeSlug,
  date,
}: {
  categories: Category[];
  activeSlug?: string;
  date?: string;
}) {
  return (
    <div className="sticky top-14 z-30 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-2.5">
        <Link
          href={hrefFor(date)}
          className={cn(PILL, !activeSlug ? "bg-accent-strong text-white" : "text-muted hover:bg-foreground/5")}
        >
          全部
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={hrefFor(date, c.slug)}
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
