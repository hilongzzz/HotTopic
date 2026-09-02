import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Category, ProjectRow, RankingRow, TrendPoint } from "./types";

/**
 * 匿名只读客户端（anon key）。环境变量未配置时返回 null，
 * 页面据此展示"未配置"引导，而不是构建期报错。
 */
let cachedClient: SupabaseClient | null | undefined;

export function getSupabaseRead(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  cachedClient = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cachedClient;
}

/**
 * 进程内 TTL 缓存。页面读取 searchParams，按请求动态渲染；
 * 这里用 5 分钟缓存挡住大部分重复查询（ingest 完成后无缓存可刷，
 * 最多延迟 TTL 见新数据，可接受）。
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
    const { data, error } = await db.from("categories").select("*").order("sort_order");
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
 * 某天的榜单（TOP 100），可按分类过滤。
 * error 非空通常意味着迁移 SQL 未执行。
 */
export async function getDailyRankings(
  date: string,
  categoryId?: number,
): Promise<{ rows: RankingRow[]; error: string | null }> {
  const db = getSupabaseRead();
  if (!db) return { rows: [], error: null };
  return memoize(`rankings:${date}:${categoryId ?? "all"}`, async () => {
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
      console.error("[queries] rankings:", error.message);
      return { rows: [], error: error.message };
    }
    return { rows: (data ?? []) as unknown as RankingRow[], error: null };
  });
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
