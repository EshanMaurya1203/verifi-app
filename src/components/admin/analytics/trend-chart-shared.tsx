import type { TrendPoint, RateTrendPoint } from "@/lib/analytics/trends";

// ─── SVG Line Chart for Count-based Trends ────────────────────────────

interface TrendLineChartProps {
  readonly data: readonly TrendPoint[];
  readonly color: string;
}

const CHART_HEIGHT = 120;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_BOTTOM = 24;
const LABEL_HEIGHT = 16;

export function TrendLineChart({ data, color }: TrendLineChartProps) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const getX = (i: number, total: number, width: number) => {
    if (total <= 1) return width / 2;
    return (i / (total - 1)) * width;
  };

  const getY = (count: number) => {
    const ratio = count / maxCount;
    return CHART_PADDING_TOP + usableHeight * (1 - ratio);
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${Math.max(data.length * 48, 280)} ${CHART_HEIGHT + LABEL_HEIGHT}`}
        className="w-full min-w-[280px]"
        preserveAspectRatio="none"
        role="img"
        aria-label="Trend line chart"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = CHART_PADDING_TOP + usableHeight * (1 - frac);
          return (
            <line
              key={frac}
              x1="0"
              y1={y}
              x2="100%"
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          );
        })}

        {/* Line path */}
        {data.length > 1 && (
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={data
              .map((d, i) => {
                const svgWidth = Math.max(data.length * 48, 280);
                const x = getX(i, data.length, svgWidth);
                const y = getY(d.count);
                return `${x},${y}`;
              })
              .join(" ")}
          />
        )}

        {/* Area fill */}
        {data.length > 1 && (
          <polygon
            fill={color}
            opacity="0.08"
            points={(() => {
              const svgWidth = Math.max(data.length * 48, 280);
              const linePoints = data
                .map((d, i) => {
                  const x = getX(i, data.length, svgWidth);
                  const y = getY(d.count);
                  return `${x},${y}`;
                })
                .join(" ");
              const lastX = getX(data.length - 1, data.length, svgWidth);
              const firstX = getX(0, data.length, svgWidth);
              const bottom = CHART_PADDING_TOP + usableHeight;
              return `${linePoints} ${lastX},${bottom} ${firstX},${bottom}`;
            })()}
          />
        )}

        {/* Data points */}
        {data.map((d, i) => {
          const svgWidth = Math.max(data.length * 48, 280);
          const x = getX(i, data.length, svgWidth);
          const y = getY(d.count);

          return (
            <g key={`${d.period}-${i}`}>
              <circle cx={x} cy={y} r="3" fill={color} />

              {/* Count label above point */}
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                className="fill-neutral-400"
                fontSize="9"
                fontWeight="500"
              >
                {d.count}
              </text>

              {/* Period label below */}
              <text
                x={x}
                y={CHART_HEIGHT + LABEL_HEIGHT - 2}
                textAnchor="middle"
                className="fill-neutral-500"
                fontSize="8"
              >
                {d.period}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── SVG Line Chart for Rate-based Trends ─────────────────────────────

interface RateTrendLineChartProps {
  readonly data: readonly RateTrendPoint[];
  readonly color: string;
}

export function RateTrendLineChart({ data, color }: RateTrendLineChartProps) {
  if (data.length === 0) return null;

  const maxRate = Math.max(...data.map((d) => d.rate), 1);
  const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const getX = (i: number, total: number, width: number) => {
    if (total <= 1) return width / 2;
    return (i / (total - 1)) * width;
  };

  const getY = (rate: number) => {
    const ratio = rate / maxRate;
    return CHART_PADDING_TOP + usableHeight * (1 - ratio);
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${Math.max(data.length * 48, 280)} ${CHART_HEIGHT + LABEL_HEIGHT}`}
        className="w-full min-w-[280px]"
        preserveAspectRatio="none"
        role="img"
        aria-label="Rate trend line chart"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = CHART_PADDING_TOP + usableHeight * (1 - frac);
          return (
            <line
              key={frac}
              x1="0"
              y1={y}
              x2="100%"
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          );
        })}

        {/* Line path */}
        {data.length > 1 && (
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={data
              .map((d, i) => {
                const svgWidth = Math.max(data.length * 48, 280);
                const x = getX(i, data.length, svgWidth);
                const y = getY(d.rate);
                return `${x},${y}`;
              })
              .join(" ")}
          />
        )}

        {/* Area fill */}
        {data.length > 1 && (
          <polygon
            fill={color}
            opacity="0.08"
            points={(() => {
              const svgWidth = Math.max(data.length * 48, 280);
              const linePoints = data
                .map((d, i) => {
                  const x = getX(i, data.length, svgWidth);
                  const y = getY(d.rate);
                  return `${x},${y}`;
                })
                .join(" ");
              const lastX = getX(data.length - 1, data.length, svgWidth);
              const firstX = getX(0, data.length, svgWidth);
              const bottom = CHART_PADDING_TOP + usableHeight;
              return `${linePoints} ${lastX},${bottom} ${firstX},${bottom}`;
            })()}
          />
        )}

        {/* Data points */}
        {data.map((d, i) => {
          const svgWidth = Math.max(data.length * 48, 280);
          const x = getX(i, data.length, svgWidth);
          const y = getY(d.rate);

          return (
            <g key={`${d.period}-${i}`}>
              <circle cx={x} cy={y} r="3" fill={color} />

              {/* Rate label above point */}
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                className="fill-neutral-400"
                fontSize="9"
                fontWeight="500"
              >
                {d.rate}%
              </text>

              {/* Period label below */}
              <text
                x={x}
                y={CHART_HEIGHT + LABEL_HEIGHT - 2}
                textAnchor="middle"
                className="fill-neutral-500"
                fontSize="8"
              >
                {d.period}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
