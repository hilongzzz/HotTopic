import Link from "next/link";
import { cn } from "@/lib/cn";
import { fmtNum } from "@/lib/format";
import { languageColor } from "@/lib/language";
import { PERIOD_CONFIGS, type PeriodType, type RankingRow } from "@/lib/types";

const RANK_STYLES: Record<number, string> = {
  1: "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
  2: "bg-gradient-to-br from-slate-300 to-slate-400 text-white",
  3: "bg-gradient-to-br from-amber-600 to-amber-800 text-white",
};

export function ProjectCard({
  row,
  period = "daily",
}: {
  row: RankingRow;
  period?: PeriodType;
}) {
  const p = row.projects;
  const cat = p.categories;
  const badgeLabel = PERIOD_CONFIGS[period].badgeLabel;

  return (
    <Link href={`/project/${p.owner}/${p.name}`} className="group block h-full">
      <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-indigo-200 group-hover:shadow-[0_8px_30px_rgba(79,70,229,0.08)]">
        <header className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums",
              row.rank <= 3 ? RANK_STYLES[row.rank] : "bg-foreground/5 text-muted",
            )}
          >
            {row.rank}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.owner_avatar_url ?? ""}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 rounded-full border border-line"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold transition-colors group-hover:text-accent-strong">
              {p.full_name}
            </h3>
            <p className="mt-0.5 flex items-center gap-2.5 text-xs text-muted">
              {p.language && (
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: languageColor(p.language) }}
                  />
                  {p.language}
                </span>
              )}
              <span>★ {fmtNum(p.stars)}</span>
            </p>
          </div>
          {period === "total" ? (
            <span className="ml-auto shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold tabular-nums text-accent-strong">
              ★ {fmtNum(p.stars)}
            </span>
          ) : row.stars_gained > 0 ? (
            <span className="ml-auto shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold tabular-nums text-emerald-600">
              +{fmtNum(row.stars_gained)} {badgeLabel}
            </span>
          ) : null}
        </header>

        {p.summary && (
          <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-foreground/90">
            {p.summary}
          </p>
        )}
        {p.description && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted">
            {p.description}
          </p>
        )}

        <footer className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
          {cat && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: (cat.color ?? "#6b7280") + "1a",
                color: cat.color ?? "#6b7280",
              }}
            >
              {cat.emoji} {cat.name}
            </span>
          )}
          {p.topics.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-md bg-foreground/5 px-1.5 py-0.5 font-mono text-[11px] text-muted"
            >
              {t}
            </span>
          ))}
        </footer>
      </article>
    </Link>
  );
}
