import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/sparkline";
import { fmtNum } from "@/lib/format";
import { languageColor } from "@/lib/language";
import { getProjectWithTrends } from "@/lib/queries";

export const revalidate = 3600;

type Props = PageProps<"/project/[owner]/[name]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, name } = await params;
  const { project } = await getProjectWithTrends(`${owner}/${name}`);
  // 在 generateMetadata 中判定 404：元数据解析先于响应流开始，
  // 这样未收录的项目能返回真正的 404 状态码（而不是 200 的软 404）
  if (!project) notFound();
  return { title: project.full_name };
}

export default async function ProjectPage({ params }: Props) {
  const { owner, name } = await params;
  const { project: p, trends } = await getProjectWithTrends(`${owner}/${name}`);
  if (!p) notFound();

  const last30 = trends.slice(-30);
  const gained30 = last30.reduce((sum, t) => sum + t.stars_gained, 0);
  const bestDay = last30.reduce((max, t) => Math.max(max, t.stars_gained), 0);
  const cat = p.categories;

  const stats = [
    { label: "Stars", value: fmtNum(p.stars) },
    { label: "Forks", value: fmtNum(p.forks) },
    { label: "近 30 日涨星", value: `+${fmtNum(gained30)}` },
    { label: "单日最高", value: `+${fmtNum(bestDay)}` },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-8">
      <Link
        href="/"
        className="text-sm text-muted transition-colors hover:text-accent-strong"
      >
        ← 返回榜单
      </Link>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-6 md:p-8">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.owner_avatar_url ?? ""}
            alt={p.owner}
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl border border-line"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-tight md:text-2xl">
              {p.full_name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              {p.language && (
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: languageColor(p.language) }}
                  />
                  {p.language}
                </span>
              )}
              {cat && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: (cat.color ?? "#6b7280") + "1a",
                    color: cat.color ?? "#6b7280",
                  }}
                >
                  {cat.emoji} {cat.name}
                </span>
              )}
            </p>
          </div>
        </div>

        {p.summary && (
          <p className="mt-4 font-medium leading-7 text-foreground/90">{p.summary}</p>
        )}
        {p.description && <p className="mt-1.5 text-sm leading-6 text-muted">{p.description}</p>}

        {p.topics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {p.topics.slice(0, 8).map((t) => (
              <span
                key={t}
                className="rounded-md bg-foreground/5 px-1.5 py-0.5 font-mono text-[11px] text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2.5">
          <a
            href={`https://github.com/${p.full_name}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-accent-strong px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            GitHub 仓库 ↗
          </a>
          {p.homepage && (
            <a
              href={p.homepage}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-accent hover:text-accent-strong"
            >
              官网 ↗
            </a>
          )}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-xl font-bold tabular-nums">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground/90">
          Star 增长曲线
          <span className="ml-2 font-normal text-muted">
            近 {Math.min(90, trends.length)} 天 · 起自 {trends[0]?.trend_date ?? "—"}
          </span>
        </h2>
        <div className="mt-3">
          <Sparkline points={trends} />
        </div>
      </section>
    </div>
  );
}
