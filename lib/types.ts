/** 分类（categories 表） */
export interface Category {
  id: number;
  slug: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

/** 项目（projects 表，含嵌入的 category） */
export interface ProjectRow {
  id: number;
  full_name: string;
  owner: string;
  name: string;
  description: string | null;
  summary: string | null;
  language: string | null;
  topics: string[];
  homepage: string | null;
  owner_avatar_url: string | null;
  stars: number;
  forks: number;
  categories: Category | null;
}

/** 每日榜单行（daily_rankings join projects） */
export interface RankingRow {
  rank: number;
  score: number;
  stars_gained: number;
  projects: ProjectRow;
}

/** 趋势点（daily_trends 行） */
export interface TrendPoint {
  trend_date: string;
  stars: number;
  stars_gained: number;
}
