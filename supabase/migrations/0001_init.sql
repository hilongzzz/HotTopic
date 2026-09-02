-- ════════════════════════════════════════════════════════════════
-- GitTrend Hub 初始化迁移
--
-- 执行方式（二选一）：
--   1. Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
--   2. supabase CLI: supabase db push
-- ════════════════════════════════════════════════════════════════

-- ══════════ 1. 分类表 ══════════
create table categories (
  id         smallint primary key generated always as identity,
  slug       text unique not null,          -- 'ai' / 'frontend' / 'backend' / 'devtools'
  name       text not null,                 -- 'AI / 机器学习'
  emoji      text,                          -- '🤖'
  color      text,                          -- 主题色 '#8b5cf6'
  sort_order smallint not null default 100
);

insert into categories (slug, name, emoji, color, sort_order) values
  ('ai',        'AI / 机器学习',   '🤖', '#8b5cf6', 1),
  ('frontend',  '前端',           '🎨', '#3b82f6', 2),
  ('backend',   '后端 / 基础设施', '⚙️', '#10b981', 3),
  ('devtools',  '开发工具',       '🛠️', '#f59e0b', 4),
  ('mobile',    '移动开发',       '📱', '#ec4899', 5),
  ('database',  '数据库',         '🗄️', '#06b6d4', 6),
  ('other',     '其他',           '📦', '#6b7280', 99);

-- ══════════ 2. 项目表（核心实体，存"最新"快照） ══════════
create table projects (
  id               bigint primary key generated always as identity,
  github_id        bigint unique not null,      -- GitHub 仓库数字 ID，做幂等键
  full_name        text not null,               -- 'vercel/next.js'
  owner            text not null,
  name             text not null,
  description      text,                        -- 英文原描述
  summary          text,                        -- AI 生成的中文一句话简介
  language         text,
  topics           text[] not null default '{}',
  homepage         text,
  owner_avatar_url text,
  stars            int not null default 0,      -- 最新 star 数（快照）
  forks            int not null default 0,
  open_issues      int,
  github_created_at timestamptz,                -- 仓库创建时间，用于榜单"新秀加成"
  category_id      smallint references categories(id),
  category_source  text not null default 'ai',  -- 'rule' 规则 | 'ai' | 'manual' 人工纠正
  first_seen_date  date not null default current_date,
  updated_at       timestamptz not null default now()
);

create index idx_projects_category on projects(category_id);
create index idx_projects_stars on projects(stars desc);
create index idx_projects_topics on projects using gin(topics);
create unique index idx_projects_full_name on projects(full_name);

-- ══════════ 3. 每日热度趋势表（时序数据，只追加不更新） ══════════
create table daily_trends (
  id           bigint primary key generated always as identity,
  project_id   bigint not null references projects(id) on delete cascade,
  trend_date   date not null,
  stars        int not null,        -- 当日 star 总数快照
  stars_gained int not null,        -- 当日新增 = stars - 前一日（预计算）
  forks        int,
  unique (project_id, trend_date)   -- 幂等：同一天重跑不会产生重复行
);

-- 首页核心查询：某天按涨星数排序
create index idx_trends_date_gained on daily_trends(trend_date, stars_gained desc);
-- 某项目趋势图
create index idx_trends_project_date on daily_trends(project_id, trend_date);

-- ══════════ 4. 每日榜单（物化结果，首页直接查，免实时计算） ══════════
create table daily_rankings (
  trend_date   date not null,
  project_id   bigint not null references projects(id) on delete cascade,
  rank         smallint not null,
  score        numeric not null,    -- 综合分：stars_gained 加权 + 新秀加成
  stars_gained int not null,        -- 冗余存储，卡片直接展示"今日 +N"
  primary key (trend_date, project_id)
);

-- ══════════ RLS：匿名只读，写入走 service_role 绕过 RLS ══════════
alter table projects       enable row level security;
alter table daily_trends   enable row level security;
alter table daily_rankings enable row level security;
alter table categories     enable row level security;

create policy "public read" on projects       for select using (true);
create policy "public read" on daily_trends   for select using (true);
create policy "public read" on daily_rankings for select using (true);
create policy "public read" on categories     for select using (true);
