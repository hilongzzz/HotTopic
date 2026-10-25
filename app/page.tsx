import { CategoryTabs } from "@/components/category-tabs";
import { DateNav } from "@/components/date-nav";
import { EmptyState } from "@/components/empty-state";
import { PeriodTabs } from "@/components/period-tabs";
import { ProjectCard } from "@/components/project-card";
import {
  firstParam,
  fmtNum,
  formatPeriodRange,
  isValidDateStr,
  parsePeriod,
  todayISO,
} from "@/lib/format";
import {
  getCategories,
  getDailyRankings,
  getLatestTrendDate,
  getRankings,
  getSupabaseRead,
} from "@/lib/queries";
import { PERIOD_CONFIGS } from "@/lib/types";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const period = parsePeriod(firstParam(sp.period));
  const dateParam = firstParam(sp.date);
  const catParam = firstParam(sp.category);

  if (!getSupabaseRead()) {
    return <EmptyState variant="setup" />;
  }

  const categories = await getCategories();
  const activeCategory = categories.find((c) => c.slug === catParam) ?? null;

  const latest = await getLatestTrendDate();
  const date = isValidDateStr(dateParam) ? dateParam : latest ?? todayISO();

  // 检查是否建表或采集过
  if (!latest && period !== "total") {
    const probe = await getDailyRankings(todayISO());
    return <EmptyState variant="setup" detail={probe.error ?? undefined} />;
  }

  const { rows, error } = await getRankings({
    period,
    date,
    categoryId: activeCategory?.id,
  });

  if (error) {
    return <EmptyState variant="setup" detail={error} />;
  }
  if (rows.length === 0) {
    return <EmptyState variant="nodata" date={date} />;
  }

  const periodConfig = PERIOD_CONFIGS[period];
  const totalGained =
    period === "total"
      ? 0
      : rows.reduce((sum, r) => sum + (r.stars_gained > 0 ? r.stars_gained : 0), 0);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {periodConfig.title}
        </h1>
        <p className="mt-2 text-sm text-muted md:text-[15px]">
          {periodConfig.subTitle}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted md:text-sm">
          <span className="font-semibold text-foreground/90">
            {period === "total" ? "历史全量" : formatPeriodRange(date, period)}
          </span>
          <span>·</span>
          <span>{rows.length} 个项目上榜</span>
          {activeCategory && (
            <>
              <span>·</span>
              <span className="font-medium text-foreground/80">
                {activeCategory.emoji} {activeCategory.name}
              </span>
            </>
          )}
          {totalGained > 0 && (
            <>
              <span>·</span>
              <span className="font-semibold text-emerald-600">
                周期累计涨星 +{fmtNum(totalGained)}
              </span>
            </>
          )}
        </div>
      </section>

      <PeriodTabs
        activePeriod={period}
        category={activeCategory?.slug}
        date={date}
      />

      <CategoryTabs
        categories={categories}
        activeSlug={activeCategory?.slug}
        period={period}
        date={date}
      />

      <DateNav
        date={date}
        period={period}
        category={activeCategory?.slug}
      />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <ProjectCard key={row.projects.id} row={row} period={period} />
          ))}
        </div>
      </section>
    </>
  );
}
