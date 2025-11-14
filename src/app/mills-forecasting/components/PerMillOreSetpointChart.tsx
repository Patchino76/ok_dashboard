import { FC, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  LabelList,
} from "recharts";
import type { PerMillSetpoint } from "../types/forecasting";

interface PerMillOreSetpointChartProps {
  data: PerMillSetpoint[];
}

interface ChartPoint {
  name: string;
  value: number; // required shift rate (t/h) – ore feed setpoint
  deltaTh: number; // delta vs current rate (t/h)
  current: number;
  currentDisplay: string;
  deltaDisplay: string;
}

const getBadgeColor = (deltaTh: number): string => {
  if (deltaTh > 3) return "#10b981"; // green: increase more than 3 t/h
  if (deltaTh < -3) return "#ef4444"; // red: decrease more than 3 t/h
  return "#fbbf24"; // yellow: between -3 and 3
};

const getDeltaArrow = (deltaTh: number): string => {
  if (deltaTh > 0.5) return "↑";
  if (deltaTh < -0.5) return "↓";
  return "→";
};

export const PerMillOreSetpointChart: FC<PerMillOreSetpointChartProps> = ({
  data,
}) => {
  const chartData: ChartPoint[] = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => {
      const name = item.millId.replace("Mill_", "M");
      const deltaTh = item.requiredShiftRate - item.currentRate;
      const deltaInt = Math.round(deltaTh);
      const currentInt = Math.round(item.currentRate);
      const deltaDisplay = `${deltaInt > 0 ? "+" : ""}${deltaInt}`;

      return {
        name,
        value: item.requiredShiftRate,
        deltaTh,
        current: item.currentRate,
        currentDisplay: String(currentInt),
        deltaDisplay,
      };
    });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="text-[11px] text-slate-500">
        Select at least one mill to see recommended setpoints.
      </div>
    );
  }

  const renderCustomLabel = (props: any) => {
    const { x, y, width, index } = props;
    const point: ChartPoint | undefined = chartData[index];
    if (!point) return <g />;

    const color = getBadgeColor(point.deltaTh);
    const arrow = getDeltaArrow(point.deltaTh);
    const deltaLabel = point.deltaDisplay;

    const centerX = x + width / 2;
    const badgeWidth = 60;
    const badgeHeight = 26;

    return (
      <g>
        <defs>
          <filter
            id="perMillBadgeShadow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.2" />
          </filter>
        </defs>
        <rect
          x={centerX - badgeWidth / 2}
          y={y - badgeHeight - 6}
          width={badgeWidth}
          height={badgeHeight}
          rx={8}
          fill={color}
          opacity={0.95}
          filter="url(#perMillBadgeShadow)"
        />
        <rect
          x={centerX - badgeWidth / 2}
          y={y - badgeHeight - 6}
          width={badgeWidth}
          height={badgeHeight}
          rx={8}
          fill="none"
          stroke="white"
          strokeWidth={0.5}
          opacity={0.4}
        />
        <text
          x={centerX}
          y={y - 10}
          textAnchor="middle"
          fill="white"
          fontSize={11}
          fontWeight={700}
        >
          {arrow} {deltaLabel}
        </text>
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p: ChartPoint = payload[0].payload;
      const arrow = getDeltaArrow(p.deltaTh);
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="font-semibold text-xs text-card-foreground">{p.name}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Current: {Math.round(p.current)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Shift SP: {Math.round(p.value)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {arrow} Δ: {p.deltaDisplay}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 40, right: 12, left: 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.9} />
            </linearGradient>
            <linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.9} />
            </linearGradient>
            <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
              <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
            opacity={0.5}
          />
          <XAxis
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={34}
          />
          <RechartsTooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
          />
          <Bar
            dataKey="value"
            radius={[8, 8, 0, 0]}
            label={renderCustomLabel}
            name="Shift SP t/h"
          >
            <LabelList
              dataKey="currentDisplay"
              position="insideBottom"
              style={{ fill: "white", fontSize: 11, fontWeight: 600 }}
            />
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                // Bars themselves are neutral ore feed rates; change is shown only in the badge color
                fill="#0f172a"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-2 flex gap-4 justify-center flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-muted-foreground">
            ↑ Strong change
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-yellow-400" />
          <span className="text-[11px] text-muted-foreground">→ Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[11px] text-muted-foreground">
            ↓ Small / negative
          </span>
        </div>
      </div>
    </div>
  );
};
