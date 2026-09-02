import { fmtNum } from "@/lib/format";

/**
 * 纯 SVG 服务端渲染的 star 增长曲线，零客户端 JS。
 */
export function Sparkline({
  points,
}: {
  points: { trend_date: string; stars: number }[];
}) {
  if (points.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        趋势数据积累中（至少需要两天的快照，明天再看就有啦）
      </p>
    );
  }

  const W = 720;
  const H = 200;
  const PAD = { l: 48, r: 20, t: 18, b: 30 };
  const n = points.length;
  const values = points.map((p) => p.stars);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.stars).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${y(min).toFixed(1)} L${x(0).toFixed(1)},${y(min).toFixed(1)} Z`;

  // 横向网格线 + 纵轴标签（4 段）
  const ticks = [0, 1 / 3, 2 / 3, 1].map((t) => min + t * span);
  // X 轴标签：首 / 中 / 尾
  const xLabels = [0, Math.floor((n - 1) / 2), n - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Star 增长曲线"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(v)}
            y2={y(v)}
            stroke="#e5e8f0"
            strokeWidth="1"
          />
          <text
            x={PAD.l - 8}
            y={y(v) + 4}
            textAnchor="end"
            fontSize="11"
            fill="#94a3b8"
          >
            {fmtNum(Math.round(v))}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#spark-fill)" />
      <path
        d={line}
        fill="none"
        stroke="#4f46e5"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r="4" fill="#4f46e5" />
      <text
        x={x(n - 1)}
        y={y(values[n - 1]) - 10}
        textAnchor="end"
        fontSize="12"
        fontWeight="600"
        fill="#4f46e5"
      >
        {fmtNum(values[n - 1])}
      </text>

      {xLabels.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 8}
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          fontSize="11"
          fill="#94a3b8"
        >
          {points[i].trend_date.slice(5)}
        </text>
      ))}
    </svg>
  );
}
