/**
 * GitTrend Hub 每日采集流水线
 *
 * 用法: npm run ingest（建议通过 GitHub Actions 每日定时触发）
 *
 * 流水线五步:
 *   ① 候选发现   GitHub Search API 双查询（新秀 + 高星活跃）
 *   ② 池内刷新   对不在今日候选里的存量项目拉取最新详情
 *   ③ 入库快照   upsert projects + 写当日 daily_trends（算 stars_gained）
 *   ④ AI 归类    仅处理新项目：规则预分类 → LLM 批量兜底
 *   ⑤ 算榜刷新   综合分排序写 daily_rankings → 触发前端缓存刷新
 *
 * 全部写入基于唯一键 upsert / 先删后插，任意时刻手动重跑均安全。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 本地加载 .env.local（tsx 不会像 Next.js 那样自动加载 env 文件）。
 * Actions 上无此文件则跳过；shell / Secrets 中已有的环境变量优先。
 */
function loadLocalEnvFile(name = ".env.local"): void {
  const file = path.join(process.cwd(), name);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const current = process.env[m[1]];
    if (current === undefined || current === "") process.env[m[1]] = value;
  }
}
loadLocalEnvFile();

// ────────────────────────── 配置 ──────────────────────────

const AI_BASE_URL = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
const AI_BATCH_SIZE = 20; // 每次批量分类的项目数
const AI_CONFIDENCE_THRESHOLD = 0.6; // 低于此置信度归入 other

const SEARCH_RECENT_DAYS = 90; // "新秀"查询：近 N 天创建
const SEARCH_RECENT_MIN_STARS = 50;
const SEARCH_ACTIVE_MIN_STARS = 500; // "高星活跃"查询
const SEARCH_ACTIVE_PUSHED_DAYS = 3;
const SEARCH_PAGES = 3; // 每个 query 最多抓几页（每页 100）

const REST_CONCURRENCY = 5; // GitHub REST 请求并发
const UPSERT_CHUNK = 500;
const RANKING_TOP_N = 100;

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`\n✗ 缺少环境变量 ${name}`);
    console.error("  请参考 .env.example 配置（本地放 .env.local，Actions 放仓库 Secrets）。\n");
    process.exit(1);
  }
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 带并发上限的 map（替代 p-limit，零依赖） */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ────────────────────────── 类型 ──────────────────────────

interface GhRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  owner: { login: string; avatar_url: string };
}

interface ProjectRecord {
  github_id: number;
  full_name: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  homepage: string | null;
  owner_avatar_url: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  github_created_at: string;
  updated_at: string;
}

interface ClassifyUpdate {
  id: number;
  category_id: number;
  category_source: "rule" | "ai";
  summary?: string;
}

// ────────────────────────── 规则预分类 ──────────────────────────

/** topics → 分类 slug 的强规则（命中即定分类，不调 AI） */
const TOPIC_RULES: Record<string, string> = {
  // AI
  ai: "ai", llm: "ai", llms: "ai", "machine-learning": "ai", "deep-learning": "ai",
  "artificial-intelligence": "ai", "generative-ai": "ai", agents: "ai", rag: "ai",
  diffusion: "ai", transformers: "ai", "stable-diffusion": "ai", nlp: "ai",
  "computer-vision": "ai", "neural-network": "ai", chatgpt: "ai", openai: "ai",
  whisper: "ai", embeddings: "ai", "fine-tuning": "ai", inference: "ai", mcp: "ai",
  // 前端
  react: "frontend", vue: "frontend", svelte: "frontend", nextjs: "frontend",
  css: "frontend", html: "frontend", tailwindcss: "frontend", frontend: "frontend",
  "ui-components": "frontend", webpack: "frontend", solidjs: "frontend", angular: "frontend",
  // 后端
  backend: "backend", api: "backend", microservices: "backend", grpc: "backend",
  graphql: "backend", websocket: "backend", "rest-api": "backend", proxy: "backend",
  // 开发工具
  cli: "devtools", terminal: "devtools", "developer-tools": "devtools", devtools: "devtools",
  vscode: "devtools", vim: "devtools", neovim: "devtools", git: "devtools",
  linting: "devtools", debugging: "devtools", shell: "devtools", zsh: "devtools",
  dotfiles: "devtools", "ci-cd": "devtools", docker: "devtools", kubernetes: "devtools",
  devops: "devtools", monitoring: "devtools", observability: "devtools",
  // 移动开发
  android: "mobile", ios: "mobile", flutter: "mobile", "react-native": "mobile",
  mobile: "mobile", swiftui: "mobile", "compose-multiplatform": "mobile",
  // 数据库
  database: "database", sql: "database", postgresql: "database", mysql: "database",
  sqlite: "database", redis: "database", "vector-database": "database",
  "search-engine": "database", olap: "database", timeseries: "database",
};

/** language → 分类 slug 的弱规则（topics 没命中时才用） */
const LANGUAGE_RULES: Record<string, string> = {
  "Jupyter Notebook": "ai",
};

function classifyByRules(topics: string[], language: string | null): string | null {
  for (const t of topics) {
    const slug = TOPIC_RULES[t.toLowerCase()];
    if (slug) return slug;
  }
  if (language && LANGUAGE_RULES[language]) return LANGUAGE_RULES[language];
  return null;
}

// ────────────────────────── GitHub API ──────────────────────────

const GH_API = "https://api.github.com";

async function ghFetch<T>(path: string, token: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${GH_API}${path}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gittrend-hub-ingest",
      },
    });
    if (res.ok) return (await res.json()) as T;
    // 限速 / 服务端错误：指数退避后重试
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      const waitSec = Number(res.headers.get("retry-after")) || attempt * 5;
      console.warn(`  ⚠ GitHub ${res.status}，${waitSec}s 后重试（第 ${attempt}/4 次）: ${path}`);
      await sleep(waitSec * 1000);
      continue;
    }
    throw new Error(`GitHub API ${res.status}: ${path} — ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error(`GitHub API 重试次数用尽: ${path}`);
}

function toProjectRecord(r: GhRepo): ProjectRecord {
  return {
    github_id: r.id,
    full_name: r.full_name,
    owner: r.owner.login,
    name: r.name,
    description: r.description,
    language: r.language,
    topics: r.topics ?? [],
    homepage: r.homepage || null,
    owner_avatar_url: r.owner.avatar_url,
    stars: r.stargazers_count,
    forks: r.forks_count,
    open_issues: r.open_issues_count,
    github_created_at: r.created_at,
    updated_at: new Date().toISOString(),
  };
}

// ────────────────────────── AI 归类 ──────────────────────────

async function classifyBatch(
  items: Pick<ProjectRecord, "full_name" | "description" | "topics" | "language">[],
  validSlugs: string[],
  apiKey: string,
): Promise<Map<string, { category: string; summary?: string; confidence: number }>> {
  const prompt = [
    "你是技术项目分类器。把每个 GitHub 项目归入一个分类，并生成中文一句话简介。",
    `可选分类（slug）: ${validSlugs.join(" / ")}`,
    '严格只输出 JSON 数组，不要任何其他文本，格式: [{"full_name":"...","category":"slug","summary":"不超过30字的中文简介","confidence":0.9}]',
    "项目列表:",
    ...items.map(
      (p) =>
        `- ${p.full_name} | 语言: ${p.language ?? "未知"} | topics: ${p.topics.join(",") || "无"} | 简介: ${p.description ?? "无"}`,
    ),
  ].join("\n");

  const res = await fetch(`${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: "你是技术项目分类器，只输出 JSON。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`AI API ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const out = new Map<string, { category: string; summary?: string; confidence: number }>();

  // 宽容解析：剥掉 markdown 围栏，截取第一个 [ 到最后一个 ]
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error(`AI 返回中未找到 JSON 数组: ${content.slice(0, 120)}`);
  const arr = JSON.parse(content.slice(start, end + 1)) as {
    full_name?: string;
    category?: string;
    summary?: string;
    confidence?: number;
  }[];
  for (const it of arr) {
    if (it.full_name && it.category && validSlugs.includes(it.category)) {
      out.set(it.full_name, {
        category: it.category,
        summary: typeof it.summary === "string" ? it.summary.slice(0, 80) : undefined,
        confidence: typeof it.confidence === "number" ? it.confidence : 0.5,
      });
    }
  }
  return out;
}

// ────────────────────────── 主流程 ──────────────────────────

async function main() {
  const GITHUB_TOKEN = requiredEnv("GITHUB_TOKEN");
  const SUPABASE_URL = requiredEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_KEY = requiredEnv("SUPABASE_SERVICE_KEY");
  const AI_API_KEY = process.env.AI_API_KEY; // 可选：不配则仅用规则分类
  const SITE_URL = process.env.SITE_URL;
  const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const dateUTC = new Date().toISOString().slice(0, 10);
  const daysAgoISO = (days: number) =>
    new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  console.log(`\n═══ GitTrend Hub ingest · ${dateUTC} (UTC) ═══\n`);

  // ── ① 候选发现：双查询互补 ──────────────────────────────
  const queries = [
    `created:>=${daysAgoISO(SEARCH_RECENT_DAYS)} stars:>=${SEARCH_RECENT_MIN_STARS}`,
    `stars:>=${SEARCH_ACTIVE_MIN_STARS} pushed:>=${daysAgoISO(SEARCH_ACTIVE_PUSHED_DAYS)}`,
  ];
  const candidates = new Map<number, GhRepo>();
  for (const q of queries) {
    for (let page = 1; page <= SEARCH_PAGES; page++) {
      const data = await ghFetch<{ total_count: number; items: GhRepo[] }>(
        `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=100&page=${page}`,
        GITHUB_TOKEN,
      );
      for (const r of data.items ?? []) if (!candidates.has(r.id)) candidates.set(r.id, r);
      console.log(`① 搜索 "${q}" 第 ${page} 页 → 累计候选 ${candidates.size}`);
      if ((data.items?.length ?? 0) < 100) break;
      await sleep(2500); // Search API 限速约 30 req/min
    }
  }

  // ── ② 池内刷新：不在今日候选中的存量项目拉最新数据 ──────
  const { data: poolRows, error: poolErr } = await db.from("projects").select("github_id, full_name");
  if (poolErr) throw new Error(`查询 projects 失败: ${poolErr.message}（迁移 SQL 是否已执行？）`);
  const pool = (poolRows ?? []) as { github_id: number; full_name: string }[];
  const candidateIds = new Set(candidates.keys());
  const stale = pool.filter((p) => !candidateIds.has(p.github_id));
  console.log(`② 池内项目 ${pool.length}，其中 ${stale.length} 个需刷新详情`);

  let skipped = 0;
  const refreshed = await mapLimit(stale, REST_CONCURRENCY, async (p) => {
    try {
      return await ghFetch<GhRepo>(`/repos/${p.full_name}`, GITHUB_TOKEN);
    } catch (e) {
      skipped++; // 404（已删除）等，跳过
      if (skipped <= 5) console.warn(`  ⚠ 跳过 ${p.full_name}: ${(e as Error).message.slice(0, 80)}`);
      return null;
    }
  });
  const allRepos = new Map<number, GhRepo>();
  for (const r of candidates.values()) allRepos.set(r.id, r);
  for (const r of refreshed) if (r) allRepos.set(r.id, r);
  console.log(`② 刷新完成，合计待入库 ${allRepos.size} 个项目${skipped ? `（跳过 ${skipped}）` : ""}`);

  // ── ③ 入库 + 当日快照 ──────────────────────────────────
  // 注意：upsert payload 故意不含 first_seen_date —— 老项目冲突更新时不会覆盖首见日期，
  // 新项目插入时由数据库默认值 current_date 填充。
  const knownIds = new Set(pool.map((p) => p.github_id));
  const newCount = [...allRepos.values()].filter((r) => !knownIds.has(r.id)).length;
  for (const part of chunk([...allRepos.values()], UPSERT_CHUNK)) {
    const { error } = await db
      .from("projects")
      .upsert(part.map(toProjectRecord), { onConflict: "github_id" });
    if (error) throw new Error(`upsert projects 失败: ${error.message}`);
  }
  console.log(`③ projects 入库完成（新项目 ${newCount}，更新 ${allRepos.size - newCount}）`);

  // github_id → projects.id 映射
  const idMap = new Map<number, number>();
  for (const part of chunk([...allRepos.keys()], 200)) {
    const { data, error } = await db.from("projects").select("id, github_id").in("github_id", part);
    if (error) throw new Error(`查询 projects.id 失败: ${error.message}`);
    for (const r of (data ?? []) as { id: number; github_id: number }[]) idMap.set(r.github_id, r.id);
  }

  // 昨日快照（无则 stars_gained 记 0 —— 宁可保守，不做虚假的"全部计为今日涨幅"）
  const prevStars = new Map<number, number>();
  {
    const yest = daysAgoISO(1);
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from("daily_trends")
        .select("project_id, stars")
        .eq("trend_date", yest)
        .range(from, from + 999);
      if (error) throw new Error(`查询昨日趋势失败: ${error.message}`);
      const rows = (data ?? []) as { project_id: number; stars: number }[];
      for (const r of rows) prevStars.set(r.project_id, r.stars);
      if (rows.length < 1000) break;
      from += 1000;
    }
  }

  let snapshotCount = 0;
  for (const part of chunk([...allRepos.values()], UPSERT_CHUNK)) {
    const rows = part.map((r) => {
      const projectId = idMap.get(r.id)!;
      const prev = prevStars.get(projectId);
      return {
        project_id: projectId,
        trend_date: dateUTC,
        stars: r.stargazers_count,
        stars_gained: prev !== undefined ? r.stargazers_count - prev : 0,
        forks: r.forks_count,
      };
    });
    const { error } = await db
      .from("daily_trends")
      .upsert(rows, { onConflict: "project_id,trend_date" });
    if (error) throw new Error(`写入 daily_trends 失败: ${error.message}`);
    snapshotCount += rows.length;
  }
  console.log(`③ 当日快照 ${snapshotCount} 条写入完成`);

  // ── ④ AI 归类：只处理"还没有分类"的项目 ────────────────
  const { data: catRows, error: catErr } = await db.from("categories").select("id, slug");
  if (catErr) throw new Error(`查询 categories 失败: ${catErr.message}`);
  const slugToId = new Map((catRows ?? []).map((c) => [c.slug as string, c.id as number]));
  const otherId = slugToId.get("other")!;

  // 分类对象：所有"还没有分类"的项目（不只新项目）——日后补配 AI key 可自动回填存量
  const toClassify: {
    id: number;
    full_name: string;
    description: string | null;
    topics: string[];
    language: string | null;
  }[] = [];
  {
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from("projects")
        .select("id, full_name, description, topics, language, category_id")
        .is("category_id", null)
        .range(from, from + 999);
      if (error) throw new Error(`查询待分类项目失败: ${error.message}`);
      const rows = (data ?? []) as (typeof toClassify)[number][];
      toClassify.push(...rows);
      if (rows.length < 1000) break;
      from += 1000;
    }
  }
  console.log(`④ 待分类项目 ${toClassify.length} 个`);

  const updates: ClassifyUpdate[] = [];
  let ruleHits = 0;

  // 第一层：规则预分类（零成本）
  const needAI: typeof toClassify = [];
  for (const p of toClassify) {
    const slug = classifyByRules(p.topics, p.language);
    if (slug && slugToId.has(slug)) {
      updates.push({ id: p.id, category_id: slugToId.get(slug)!, category_source: "rule" });
      ruleHits++;
    } else {
      needAI.push(p);
    }
  }

  // 第二层：LLM 批量兜底
  if (needAI.length > 0) {
    if (!AI_API_KEY) {
      console.warn("  ⚠ 未配置 AI_API_KEY，跳过 LLM 分类（这些项目下次运行仍会重试）");
    } else {
      const validSlugs = [...slugToId.keys()];
      let done = 0;
      for (const batch of chunk(needAI, AI_BATCH_SIZE)) {
        try {
          const result = await classifyBatch(batch, validSlugs, AI_API_KEY);
          for (const p of batch) {
            const hit = result.get(p.full_name);
            if (!hit) continue; // AI 漏掉的下次再试
            const lowConfidence = hit.confidence < AI_CONFIDENCE_THRESHOLD;
            updates.push({
              id: p.id,
              category_id: lowConfidence ? otherId : slugToId.get(hit.category)!,
              category_source: "ai",
              summary: hit.summary,
            });
          }
        } catch (e) {
          console.warn(`  ⚠ 本批 AI 分类失败（不阻断流水线）: ${(e as Error).message.slice(0, 120)}`);
        }
        done += batch.length;
        console.log(`④ AI 分类进度 ${done}/${needAI.length}`);
      }
    }
  }

  for (const u of updates) {
    const { error } = await db
      .from("projects")
      .update({
        category_id: u.category_id,
        category_source: u.category_source,
        ...(u.summary ? { summary: u.summary } : {}),
      })
      .eq("id", u.id);
    if (error) console.warn(`  ⚠ 分类写入失败 project#${u.id}: ${error.message}`);
  }
  console.log(`④ 归类完成：规则 ${ruleHits} · AI/兜底 ${updates.length - ruleHits}`);

  // ── ⑤ 每日榜单：综合分 = 当日涨星 × 新秀加成 ────────────
  interface Meta {
    id: number;
    github_created_at: string | null;
    first_seen_date: string;
    category_id: number | null;
  }
  const metaById = new Map<number, Meta>();
  {
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from("projects")
        .select("id, github_created_at, first_seen_date, category_id")
        .range(from, from + 999);
      if (error) throw new Error(`查询 projects 元信息失败: ${error.message}`);
      const rows = (data ?? []) as Meta[];
      for (const r of rows) metaById.set(r.id, r);
      if (rows.length < 1000) break;
      from += 1000;
    }
  }

  const gainedRows: { project_id: number; stars_gained: number }[] = [];
  {
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from("daily_trends")
        .select("project_id, stars_gained")
        .eq("trend_date", dateUTC)
        .range(from, from + 999);
      if (error) throw new Error(`查询当日涨幅失败: ${error.message}`);
      const rows = (data ?? []) as { project_id: number; stars_gained: number }[];
      gainedRows.push(...rows);
      if (rows.length < 1000) break;
      from += 1000;
    }
  }

  const now = Date.now();
  const scored = gainedRows
    .filter((r) => r.stars_gained > 0 && metaById.has(r.project_id))
    .map((r) => {
      const m = metaById.get(r.project_id)!;
      const createdMs = m.github_created_at
        ? Date.parse(m.github_created_at)
        : Date.parse(m.first_seen_date + "T00:00:00Z");
      const ageDays = Math.max(0, (now - createdMs) / 86_400_000);
      // 新秀加成：越年轻权重越高，防止老牌巨无霸永远霸榜
      const score = r.stars_gained * (1 + 2 * Math.exp(-ageDays / 30));
      return { project_id: r.project_id, score, stars_gained: r.stars_gained };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, RANKING_TOP_N);

  // 首次运行没有昨日基线，全部增量为 0 → 退化为按总星数生成"首日热榜"
  let ranked = scored;
  if (ranked.length === 0 && prevStars.size === 0 && gainedRows.length > 0) {
    ranked = [...allRepos.values()]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, RANKING_TOP_N)
      .map((r) => ({ project_id: idMap.get(r.id)!, score: r.stargazers_count, stars_gained: 0 }));
    console.log(`⑤ 首次运行：无增量基线，改用总星数生成首日热榜`);
  }

  const { error: delErr } = await db.from("daily_rankings").delete().eq("trend_date", dateUTC);
  if (delErr) throw new Error(`清理旧榜单失败: ${delErr.message}`);
  if (ranked.length > 0) {
    const rows = ranked.map((s, i) => ({
      trend_date: dateUTC,
      project_id: s.project_id,
      rank: i + 1,
      score: Number(s.score.toFixed(2)),
      stars_gained: s.stars_gained,
    }));
    for (const part of chunk(rows, UPSERT_CHUNK)) {
      const { error } = await db.from("daily_rankings").insert(part);
      if (error) throw new Error(`写入 daily_rankings 失败: ${error.message}`);
    }
  }
  console.log(`⑤ 榜单生成：TOP ${ranked.length}（涨星项目共 ${gainedRows.filter((r) => r.stars_gained > 0).length}）`);

  // 校验：榜单为空视为异常（GitHub/AI 全挂也该有快照）
  if (ranked.length === 0) throw new Error("今日榜单为空，请检查 Search API 返回是否正常");

  // ── ⑥ 刷新前端缓存 ─────────────────────────────────────
  if (SITE_URL && REVALIDATE_SECRET) {
    try {
      const res = await fetch(`${SITE_URL.replace(/\/$/, "")}/api/revalidate?secret=${REVALIDATE_SECRET}`);
      console.log(`⑥ 缓存刷新: ${res.ok ? "成功" : `HTTP ${res.status}`}`);
    } catch (e) {
      console.warn(`  ⚠ 缓存刷新失败（不影响数据）: ${(e as Error).message}`);
    }
  } else {
    console.log("⑥ 未配置 SITE_URL/REVALIDATE_SECRET，跳过缓存刷新");
  }

  console.log(
    `\n✓ 完成 — 候选 ${candidates.size} · 入库 ${allRepos.size}（新 ${newCount}）· 榜单 TOP ${ranked.length}\n`,
  );
}

main().catch((e) => {
  console.error(`\n✗ ingest 失败: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
