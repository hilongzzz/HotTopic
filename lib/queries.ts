import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO } from "./format";
import {
  PERIOD_CONFIGS,
  type Category,
  type PeriodType,
  type ProjectRow,
  type RankingRow,
  type TrendPoint,
} from "./types";

/**
 * 匿名只读客户端（anon key）。环境变量未配置时返回 null，
 * 页面据此展示"未配置"引导，而不是构建期报错。
 */
let cachedClient: SupabaseClient | null | undefined;

export function getSupabaseRead(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  cachedClient =
    url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cachedClient;
}

/**
 * 进程内 TTL 缓存。页面读取 searchParams，按请求动态渲染；
 * 这里用 5 分钟缓存挡住大部分重复查询。
 */
const TTL_MS = 5 * 60 * 1000;
const memo = new Map<string, { at: number; value: unknown }>();

async function memoize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

export async function getCategories(): Promise<Category[]> {
  const db = getSupabaseRead();
  if (!db) return [];
  return memoize("categories", async () => {
    const { data, error } = await db
      .from("categories")
      .select("*")
      .order("sort_order");
    if (error) {
      console.error("[queries] categories:", error.message);
      return [];
    }
    return (data ?? []) as Category[];
  });
}

/** 榜单中最新有数据的日期（默认展示日） */
export async function getLatestTrendDate(): Promise<string | null> {
  const db = getSupabaseRead();
  if (!db) return null;
  return memoize("latest-date", async () => {
    const { data } = await db
      .from("daily_rankings")
      .select("trend_date")
      .order("trend_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { trend_date: string } | null)?.trend_date ?? null;
  });
}

/**
 * 单日榜单（TOP 100），可按分类过滤。
 */
export async function getDailyRankings(
  date: string,
  categoryId?: number,
): Promise<{ rows: RankingRow[]; error: string | null }> {
  const db = getSupabaseRead();
  if (!db) return { rows: [], error: null };
  return memoize(`rankings:daily:${date}:${categoryId ?? "all"}`, async () => {
    let q = db
      .from("daily_rankings")
      .select(
        `rank, score, stars_gained,
         projects!inner (
           id, full_name, owner, name, description, summary, language, topics,
           homepage, owner_avatar_url, stars, forks,
           categories ( id, slug, name, emoji, color )
         )`,
      )
      .eq("trend_date", date)
      .order("rank")
      .limit(100);
    if (categoryId) q = q.eq("projects.category_id", categoryId);
    const { data, error } = await q;
    if (error) {
      console.error("[queries] daily_rankings:", error.message);
      return { rows: [], error: error.message };
    }
    return { rows: (data ?? []) as unknown as RankingRow[], error: null };
  });
}

/**
 * 历史总榜（按项目总 Star 降序排）
 */
export async function getTotalRankings(
  categoryId?: number,
): Promise<{ rows: RankingRow[]; error: string | null }> {
  const db = getSupabaseRead();
  if (!db) return { rows: [], error: null };
  return memoize(`rankings:total:${categoryId ?? "all"}`, async () => {
    let q = db
      .from("projects")
      .select(
        `id, full_name, owner, name, description, summary, language, topics,
         homepage, owner_avatar_url, stars, forks,
         categories ( id, slug, name, emoji, color )`,
      )
      .order("stars", { ascending: false })
      .limit(100);

    if (categoryId) q = q.eq("category_id", categoryId);
    const { data, error } = await q;
    if (error) {
      console.error("[queries] total_rankings:", error.message);
      return { rows: [], error: error.message };
    }

    const rows: RankingRow[] = ((data ?? []) as unknown as ProjectRow[]).map(
      (p, idx) => ({
        rank: idx + 1,
        score: p.stars,
        stars_gained: p.stars,
        projects: p,
      }),
    );
    return { rows, error: null };
  });
}

/**
 * 周期榜单（周榜、月榜、季度榜、年度榜）
 * 策略：优先查 period_rankings 物化表；若表不存在或无数据，自动从 daily_trends 聚合回退。
 */
export async function getPeriodRankings(
  period: "weekly" | "monthly" | "quarterly" | "yearly",
  anchorDate: string,
  categoryId?: number,
): Promise<{ rows: RankingRow[]; error: string | null }> {
  const db = getSupabaseRead();
  if (!db) return { rows: [], error: null };

  const cacheKey = `rankings:${period}:${anchorDate}:${categoryId ?? "all"}`;
  return memoize(cacheKey, async () => {
    // 1. 尝试物化表
    let q = db
      .from("period_rankings")
      .select(
        `rank, score, stars_gained,
         projects!inner (
           id, full_name, owner, name, description, summary, language, topics,
           homepage, owner_avatar_url, stars, forks,
           categories ( id, slug, name, emoji, color )
         )`,
      )
      .eq("period_type", period)
      .eq("anchor_date", anchorDate)
      .order("rank")
      .limit(100);

    if (categoryId) q = q.eq("projects.category_id", categoryId);

    const { data: materialized, error: matErr } = await q;
    if (!matErr && materialized && materialized.length > 0) {
      return { rows: materialized as unknown as RankingRow[], error: null };
    }

    // 2. 回退聚合查询：基于 daily_trends 动态聚合
    const days = PERIOD_CONFIGS[period].days;
    const startDate = addDaysISO(anchorDate, -(days - 1));

    const trendsQuery = db
      .from("daily_trends")
      .select("project_id, stars_gained")
      .gte("trend_date", startDate)
      .lte("trend_date", anchorDate);

    const { data: trendRows, error: trendErr } = await trendsQuery;
    if (trendErr) {
      console.error(`[queries] fallback trends aggregation (${period}):`, trendErr.message);
      return { rows: [], error: trendErr.message };
    }

    if (!trendRows || trendRows.length === 0) {
      return { rows: [], error: null };
    }

    // 按 project_id 聚合累加 stars_gained
    const gainsMap = new Map<number, number>();
    for (const t of trendRows) {
      const prev = gainsMap.get(t.project_id) ?? 0;
      gainsMap.set(t.project_id, prev + (t.stars_gained > 0 ? t.stars_gained : 0));
    }

    // 排序取 TOP 200 候选项（预留分类过滤余量）
    const sortedProjectIds = Array.from(gainsMap.entries())
      .filter(([, sum]) => sum > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, 200);

    if (sortedProjectIds.length === 0) {
      return { rows: [], error: null };
    }

    let projQuery = db
      .from("projects")
      .select(
        `id, full_name, owner, name, description, summary, language, topics,
         homepage, owner_avatar_url, stars, forks,
         categories ( id, slug, name, emoji, color )`,
      )
      .in("id", sortedProjectIds);

    if (categoryId) projQuery = projQuery.eq("category_id", categoryId);

    const { data: projData, error: projErr } = await projQuery;
    if (projErr) {
      console.error(`[queries] fallback project details (${period}):`, projErr.message);
      return { rows: [], error: projErr.message };
    }

    const projectsMap = new Map<number, ProjectRow>();
    for (const p of (projData ?? []) as unknown as ProjectRow[]) {
      projectsMap.set(p.id, p);
    }

    const rows: RankingRow[] = [];
    let rankCounter = 1;
    for (const pid of sortedProjectIds) {
      const p = projectsMap.get(pid);
      if (!p) continue;
      const gained = gainsMap.get(pid) ?? 0;
      rows.push({
        rank: rankCounter++,
        score: gained,
        stars_gained: gained,
        projects: p,
      });
      if (rows.length >= 100) break;
    }

    return { rows, error: null };
  });
}

/**
 * 统一获取榜单入口函数
 */
export async function getRankings({
  period,
  date,
  categoryId,
}: {
  period: PeriodType;
  date?: string;
  categoryId?: number;
}): Promise<{ rows: RankingRow[]; error: string | null }> {
  if (period === "total") {
    return getTotalRankings(categoryId);
  }
  const anchorDate = date || (await getLatestTrendDate()) || addDaysISO(new Date().toISOString().slice(0, 10), 0);
  if (period === "daily") {
    return getDailyRankings(anchorDate, categoryId);
  }
  return getPeriodRankings(period, anchorDate, categoryId);
}

/** 项目详情 + 趋势序列（详情页） */
export async function getProjectWithTrends(
  fullName: string,
): Promise<{ project: ProjectRow | null; trends: TrendPoint[] }> {
  const db = getSupabaseRead();
  if (!db) return { project: null, trends: [] };
  const { data, error } = await db
    .from("projects")
    .select(
      `id, full_name, owner, name, description, summary, language, topics,
       homepage, owner_avatar_url, stars, forks,
       categories ( id, slug, name, emoji, color )`,
    )
    .eq("full_name", fullName)
    .maybeSingle();
  if (error) {
    console.error("[queries] project:", error.message);
    return { project: null, trends: [] };
  }
  const project = (data ?? null) as ProjectRow | null;
  if (!project) return { project: null, trends: [] };

  const { data: trendRows } = await db
    .from("daily_trends")
    .select("trend_date, stars, stars_gained")
    .eq("project_id", project.id)
    .order("trend_date", { ascending: true })
    .limit(90);
  return { project, trends: (trendRows ?? []) as unknown as TrendPoint[] };
}
