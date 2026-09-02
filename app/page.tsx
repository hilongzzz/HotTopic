import { CategoryTabs } from "@/components/category-tabs";
import { DateNav } from "@/components/date-nav";
import { EmptyState } from "@/components/empty-state";
import { ProjectCard } from "@/components/project-card";
import {
  dateLabel,
  firstParam,
  fmtNum,
  isValidDateStr,
  todayISO,
} from "@/lib/format";
import {
  getCategories,
  getDailyRankings,
  getLatestTrendDate,
  getSupabaseRead,
} from "@/lib/queries";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const dateParam = firstParam(sp.date);
  const catParam = firstParam(sp.category);

  if (!getSupabaseRead()) {
    return <EmptyState variant="setup" />;
  }

  const categories = await getCategories();
  const activeCategory = categories.find((c) => c.slug === catParam) ?? null;

  const latest = await getLatestTrendDate();
  const date = isValidDateStr(dateParam) ? dateParam : latest;

  if (!date) {
    // 榜单表里一条数据都没有：区分"迁移没跑"和"还没采集过"
    const probe = await getDailyRankings(todayISO());
    return <EmptyState variant="setup" detail={probe.error ?? undefined} />;
  }

  const { rows, error } = await getDailyRankings(date, activeCategory?.id);
  if (error) {
    return <EmptyState variant="setup" detail={error} />;
  }
  if (rows.length === 0) {
    return <EmptyState variant="nodata" date={date} />;
  }

  const totalGained = rows.reduce((sum, r) => sum + r.stars_gained, 0);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-5 pt-10">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          GitHub 热点开源项目
        </h1>
        <p className="mt-2.5 text-sm text-muted md:text-[15px]">
          <span className="font-medium text-foreground/80">{dateLabel(date)}</span>
          {" · "}
          {rows.length} 个项目上榜
          {activeCategory && ` · ${activeCategory.emoji} ${activeCategory.name}`}
          {totalGained > 0 && ` · 单日共涨 ${fmtNum(totalGained)} stars`}
        </p>
      </section>

      <CategoryTabs
        categories={categories}
        activeSlug={activeCategory?.slug}
        date={date}
      />
      <DateNav date={date} category={activeCategory?.slug} />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <ProjectCard key={row.projects.id} row={row} />
          ))}
        </div>
      </section>
    </>
  );
}
