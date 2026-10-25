-- ════════════════════════════════════════════════════════════════
-- GitTrend Hub: 周期榜单扩展（周榜、月榜、季度榜、年度榜、总榜）
-- ════════════════════════════════════════════════════════════════

-- ══════════ 5. 周期榜单表（物化结果，支持 weekly / monthly / quarterly / yearly / total） ══════════
create table if not exists period_rankings (
  period_type  text not null,        -- 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'total'
  anchor_date  date not null,        -- 统计锚点日期（如 2026-10-25）
  project_id   bigint not null references projects(id) on delete cascade,
  rank         smallint not null,
  score        numeric not null,
  stars_gained int not null,        -- 该周期内的累计涨星数（总榜可存当前 stars）
  primary key (period_type, anchor_date, project_id)
);

create index if not exists idx_period_rankings_lookup
  on period_rankings(period_type, anchor_date, rank);

create index if not exists idx_period_rankings_project
  on period_rankings(project_id, period_type);

-- ══════════ RLS：匿名只读，写入走 service_role ══════════
alter table period_rankings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'period_rankings' and policyname = 'public read period_rankings'
  ) then
    create policy "public read period_rankings" on period_rankings for select using (true);
  end if;
end $$;
