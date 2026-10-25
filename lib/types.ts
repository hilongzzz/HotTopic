/** 分类（categories 表） */
export interface Category {
  id: number;
  slug: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

/** 榜单周期类型 */
export type PeriodType =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "total";

export interface PeriodConfig {
  type: PeriodType;
  label: string;
  shortLabel: string;
  badgeLabel: string;
  days: number; // 0 表示总榜（历史全量）
  title: string;
  subTitle: string;
}

export const PERIOD_CONFIGS: Record<PeriodType, PeriodConfig> = {
  daily: {
    type: "daily",
    label: "今日榜",
    shortLabel: "日榜",
    badgeLabel: "今日",
    days: 1,
    title: "GitHub 日度热点项目",
    subTitle: "每日 GitHub 增速最高、新秀表现亮眼的开源项目",
  },
  weekly: {
    type: "weekly",
    label: "本周榜",
    shortLabel: "周榜",
    badgeLabel: "7天",
    days: 7,
    title: "GitHub 周度热度榜",
    subTitle: "近 7 天内社区关注度与 Star 爆发力最强项目",
  },
  monthly: {
    type: "monthly",
    label: "本月榜",
    shortLabel: "月榜",
    badgeLabel: "30天",
    days: 30,
    title: "GitHub 月度热度榜",
    subTitle: "近 30 天稳步攀升、热度持续在线的黑马与主力项目",
  },
  quarterly: {
    type: "quarterly",
    label: "季度榜",
    shortLabel: "季榜",
    badgeLabel: "90天",
    days: 90,
    title: "GitHub 季度热门榜",
    subTitle: "近 90 天开源生态最具影响力的领跑者",
  },
  yearly: {
    type: "yearly",
    label: "年度榜",
    shortLabel: "年榜",
    badgeLabel: "1年",
    days: 365,
    title: "GitHub 年度风云榜",
    subTitle: "近 1 年开源世界年度明星与现象级爆款项目",
  },
  total: {
    type: "total",
    label: "总榜",
    shortLabel: "总榜",
    badgeLabel: "总计",
    days: 0,
    title: "GitHub 历史总榜",
    subTitle: "开源世界累计 Star 最高、影响力无可撼动的经典殿堂",
  },
};

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

/** 榜单行（daily_rankings 或 period_rankings join projects） */
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
