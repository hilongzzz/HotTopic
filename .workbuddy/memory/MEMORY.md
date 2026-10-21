# HotTopic / GitTrend Hub — 项目长期约定

## 数据模型的关键约束（易踩坑）

`projects` 表有**两个**唯一键，它们语义不同：
- `github_id` — 仓库**身份**。GitHub 数字 ID 永不复用，是真正的幂等键。
- `idx_projects_full_name` — 仓库**地址**。可变：仓库可改名，名字可被删除后重建的新仓库接管。

**推论：任何写入都必须同时尊重两个键。** Postgres 的 `ON CONFLICT` 只能仲裁一个索引，
所以 `upsert(onConflict: "github_id")` 遇到 full_name 冲突会整批回滚。
写入前必须先「腾位」（把旧行改成 `vacated-<github_id>` 临时名让出地址）。

真实 full_name 恒为 `owner/repo`（含一个 `/`），因此不含 `/` 的临时名
（如 `vacated-123`）永远不会与真实地址或 GitHub 仓库名冲突 —— 这是安全腾位的前提。

## PostgREST / Supabase 注意事项

- **单次查询默认最多返回 1000 行**。所有全表查询必须显式分页
  （`.order("id").range(from, from + 999)` 循环），否则池子一旦破千就会被静默截断。
  本项目曾因此让 7 个存量项目长期未被刷新。
- `onConflict` 传多列（如 `"github_id,full_name"`）会报
  `there is no unique or exclusion constraint matching the ON CONFLICT specification`，
  除非存在对应的联合唯一索引。

## ingest 流水线（scripts/ingest.ts）

五步：① 候选发现（Search API 双查询）→ ② 池内刷新（REST 拉存量详情）
→ ③ 入库快照（upsert + daily_trends）→ ④ AI 归类 → ⑤ 算榜（daily_rankings）。

- ② 的刷新是**按地址 GET**，会跟随 GitHub 的 301 重定向：
  改名仓库 → 拿到同 id 新名；删除后同名重建 → 拿到**新 id 同名**（冲突来源）。
  ②的结果比 ①的搜索索引更权威，同一地址多 id 时优先采信 ②。
- `upsert` payload **故意不含 `first_seen_date`**：老项目冲突更新时不覆盖首见日期，
  新项目插入时由数据库默认值 `current_date` 填充。
- `daily_trends` 只追加不更新；`stars_gained` 无昨日基线时记 0（宁可保守）。

## 环境

- 本地沙箱**无法直连 api.github.com**（代理对 undici 不生效），完整 ingest 只能靠 CI；
  但 Supabase 本地完全可连，问题复现与验证应在 DB 侧做。
- 探测/修改生产数据后必须用 `daily_trends` 历史快照还原，并确认零残留。
