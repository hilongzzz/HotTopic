# GitTrend Hub

每天自动追踪 GitHub 热点开源项目，AI 智能归类，以卡片流呈现，支持按日期与分类筛选。

**技术栈**：Next.js 16 · Supabase · GitHub Actions · OpenAI 兼容 LLM 接口

📖 完整架构设计见 `docs/architecture.html`。

## 快速上手

### 1. 建数据库

创建 [Supabase](https://supabase.com) 项目，在 **SQL Editor** 中执行：
- [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)（四张核心表 + 索引 + RLS + 分类种子数据）；
- [`supabase/migrations/0002_add_period_rankings.sql`](supabase/migrations/0002_add_period_rankings.sql)（周期榜单表：支持周/月/季/年/总榜物化加速；未执行时系统亦会自动启用动态聚合回退，零阻断）。

### 2. 配置环境变量

```bash
cp .env.example .env.local
# 填入 SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY / GITHUB_TOKEN
# AI_API_KEY 可选：不配则只使用规则分类
```

| 变量 | 用在哪 | 说明 |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | 前端 RSC 查询 | 匿名只读 |
| `SUPABASE_SERVICE_KEY` | 仅 ingest 脚本 | 绕过 RLS 写入，**绝不**暴露给浏览器 |
| `GITHUB_TOKEN` | 仅 ingest 脚本 | PAT，公开仓库只读即可 |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | 仅 ingest 脚本 | OpenAI 兼容接口，可选 |
| `SITE_URL` / `REVALIDATE_SECRET` | ingest → 前端 | 采集后刷新缓存，可选 |

### 3. 跑一次采集

```bash
npm run ingest
```

流水线五步：候选发现 → 池内刷新 → 入库快照 → AI 归类 → 生成榜单。
全部写入基于唯一键 upsert / 先删后插，**随时手动重跑均安全**。

### 4. 启动 / 部署

```bash
npm run dev     # 本地 http://localhost:3000
```

部署到 Vercel：导入仓库，配置 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY` 两个环境变量即可。

## 每日自动化（GitHub Actions）

`.github/workflows/ingest.yml` 已就绪，每天 **UTC 2:00（北京时间 10:00）** 自动运行，
也支持在 Actions 页面手动 `workflow_dispatch` 触发。

在仓库 **Settings → Secrets and variables → Actions** 配置：

| 类型 | 名称 |
|---|---|
| Secret | `GH_PAT`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`AI_API_KEY`（可选）、`REVALIDATE_SECRET`（可选）、`SLACK_WEBHOOK`（可选，失败告警） |
| Variable | `AI_BASE_URL`、`AI_MODEL`、`SITE_URL`（均可选） |

> 首次建议连续手动触发几天，让 `daily_trends` 积累出 star 日增量，趋势图才有内容。

## 目录结构

```
app/                        Next.js 页面（首页卡片流 / 项目详情 / revalidate API）
components/                 卡片、分类标签、日期导航、趋势图等
lib/                        Supabase 客户端、查询、类型、格式化
scripts/ingest.ts           每日采集流水线（npm run ingest）
supabase/migrations/        SQL 迁移
.github/workflows/          每日定时任务
docs/architecture.html      完整架构设计文档
```

## 榜单维度与数据说明

- **多周期榜单**：
  - **日榜（Daily）**：按单日 `stars_gained` 及新秀加权分排序，支持任意历史日期回溯。
  - **周榜（Weekly）**：最近 7 天内累计涨星排行榜。
  - **月榜（Monthly）**：最近 30 天内累计涨星排行榜。
  - **季度榜（Quarterly）**：最近 90 天内累计涨星排行榜。
  - **年度榜（Yearly）**：最近 365 天内累计涨星排行榜。
  - **总榜（Total）**：项目全量累计 Star 排行榜，汇聚历史最经典殿堂级项目。
- **热度 = 周期 star 增量**：每天快照全部池内项目的 star 数，`stars_gained = 今日 − 昨日`。
  新项目首日无对比基准，增量记 0（宁可保守，不做虚假涨幅）。
- **榜单综合分**：`score = stars_gained × (1 + 2·e^(−仓库年龄天数/半衰期))`，
  新秀项目加权，防止老牌巨无霸永远霸榜。
- **分类来源**：`category_source` 标记 `rule`（规则映射）/ `ai`（LLM 判定）/ `manual`（人工纠正）。
  AI 置信度低于 0.6 归入"其他"。
