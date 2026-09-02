import { dateLabel } from "@/lib/format";

export function EmptyState({
  variant,
  detail,
  date,
}: {
  variant: "setup" | "nodata";
  detail?: string;
  date?: string;
}) {
  if (variant === "nodata") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="text-5xl">📭</div>
        <h2 className="mt-4 text-lg font-semibold">
          {date ? `${dateLabel(date)}暂无榜单数据` : "暂无榜单数据"}
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          数据每天北京时间 10:00 由 GitHub Actions 自动采集。
          <br />
          也可以到仓库的 Actions 页面手动运行{" "}
          <code>Daily Ingest</code> 立即生成。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="rounded-2xl border border-line bg-surface p-8">
        <div className="text-4xl">🛠️</div>
        <h2 className="mt-3 text-lg font-semibold">还没连接数据库</h2>
        {detail && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
            {detail}
          </p>
        )}
        <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm leading-7 text-muted">
          <li>
            创建{" "}
            <a
              className="font-medium text-accent-strong underline underline-offset-2"
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
            >
              Supabase
            </a>{" "}
            项目，在 SQL Editor 中执行{" "}
            <code>supabase/migrations/0001_init.sql</code>
          </li>
          <li>
            复制 <code>.env.example</code> 为 <code>.env.local</code>
            ，填入 <code>SUPABASE_URL</code> 与 <code>SUPABASE_ANON_KEY</code>
          </li>
          <li>
            运行 <code>npm run ingest</code> 采集一批数据，然后刷新本页
          </li>
        </ol>
      </div>
    </div>
  );
}
