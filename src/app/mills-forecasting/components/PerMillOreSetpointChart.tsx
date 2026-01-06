import { FC, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  LabelList,
  CartesianGrid,
} from "recharts";
import type { PerMillSetpoint } from "../types/forecasting";

interface PerMillOreSetpointChartProps {
  data: PerMillSetpoint[];
}

interface ChartPoint {
  name: string;
  current: number; // Visual height of the dark bar (Base)
  originalCurrent: number; // The actual current rate value (for tooltip)
  adjustmentPositive: number; // Positive adjustment (green/orange on top)
  adjustmentNegative: number; // Negative adjustment (red/blue on top)
  adjustment: number; // Raw adjustment value
  isFixed: boolean; // True if mill is excluded from adjustments
  currentDisplay: string;
  adjustmentDisplay: string;
}

// Color thresholds - blue for < -5, orange for -5 to +5, green for > +5
const getAdjustmentColor = (adjustment: number): string => {
  if (adjustment > 5) return "#10b981"; // Green: Strong positive
  if (adjustment >= -5) return "#f97316"; // Orange: Small change (-5 to +5)
  return "#3b82f6"; // Blue: Strong negative (< -5)
};

const getAdjustmentLabel = (adjustment: number): string => {
  const rounded = Math.round(adjustment);
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : ""}${rounded}`;
};

export const PerMillOreSetpointChart: FC<PerMillOreSetpointChartProps> = ({
  data,
}) => {
  const chartData: ChartPoint[] = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => {
      const name = item.millId.replace("Mill", "M");
      const adjustment = item.adjustmentNeeded;
      const current = item.currentRate;
      const isFixed = adjustment === 0; // Fixed mills have zero adjustment

      // Logic for visual representation:
      // Increase: Dark Bar = Current, Colored Bar = Adjustment. Total = Proposed.
      // Decrease: Dark Bar = Proposed (Current - |Adj|), Colored Bar = |Adjustment|. Total = Current.
      const absAdjustment = Math.abs(adjustment);
      const chartCurrent = adjustment < 0 ? current - absAdjustment : current;

      return {
        name,
        current: chartCurrent,
        originalCurrent: current,
        adjustmentPositive: adjustment > 0 ? adjustment : 0,
        adjustmentNegative: adjustment < 0 ? absAdjustment : 0,
        adjustment,
        isFixed,
        currentDisplay: String(Math.round(chartCurrent)),
        adjustmentDisplay: isFixed ? "" : getAdjustmentLabel(adjustment),
      };
    });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="text-[11px] text-slate-500">
        Изберете поне една мелница, за да видите препоръчаните стойности.
      </div>
    );
  }

  // Custom label for adjustment values at the top of bars
  const renderAdjustmentLabel = (props: any, type: "positive" | "negative") => {
    const { x, y, width, height, index, value } = props;
    const point = chartData[index];

    // Strict check: only render if adjustment matches the bar type
    if (!point) return <g />;
    if (type === "positive" && point.adjustment <= 0) return <g />;
    if (type === "negative" && point.adjustment >= 0) return <g />;

    const centerX = x + width / 2;
    const color = getAdjustmentColor(point.adjustment);

    // Position above the bar
    return (
      <text
        x={centerX}
        y={y - 8} // Position above the adjustment bar
        textAnchor="middle"
        fill={color}
        fontSize={11}
        fontWeight={700}
      >
        {point.adjustmentDisplay}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p: ChartPoint = payload[0].payload;
      const current = Math.round(p.originalCurrent);
      const required = Math.round(current + p.adjustment);

      return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="font-semibold text-sm text-slate-900">{p.name}</p>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-600">
              Текущо: <span className="font-semibold">{current} t/h</span>
            </p>
            <p className="text-xs text-slate-600">
              Необходимо: <span className="font-semibold">{required} t/h</span>
            </p>
            <p
              className="text-xs font-bold"
              style={{ color: getAdjustmentColor(p.adjustment) }}
            >
              Корекция: {p.adjustmentDisplay}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate totals for the summary bar
  const totalCurrent = chartData.reduce((sum, item) => sum + item.current, 0);
  const totalAdjustment = chartData.reduce(
    (sum, item) => sum + item.adjustment,
    0
  );
  const totalTarget = totalCurrent + totalAdjustment;

  // Calculate percentages for the bar (assuming max range is somewhat larger than max of current/target)
  const maxRange = Math.max(totalCurrent, totalTarget) * 1.2 || 100;
  const currentPercent = (totalCurrent / maxRange) * 100;
  const targetPercent = (totalTarget / maxRange) * 100;

  return (
    <div className="space-y-4">
      {/* Combined Ore Rate Summary Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Разход на руда на всички МА
          </span>
          <div className="flex gap-3">
            <span className="text-slate-600">
              Текущо: <b>{Math.round(totalCurrent)}</b> t/h
            </span>
            <span
              className={`font-bold ${
                totalAdjustment >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              Цел: {Math.round(totalTarget)} t/h (
              {totalAdjustment > 0 ? "+" : ""}
              {Math.round(totalAdjustment)})
            </span>
          </div>
        </div>
        <div className="h-5 bg-slate-100 rounded-sm relative overflow-hidden">
          {/* Target Marker Line - Red and prominent */}
          <div
            className="absolute -top-1 -bottom-1 w-1 bg-red-600 z-10 rounded-full shadow-sm"
            style={{ left: `${targetPercent}%`, transform: "translateX(-50%)" }}
          />
          {/* Current Rate Bar */}
          <div
            className="absolute top-0 left-0 h-full bg-slate-700 transition-all duration-300"
            style={{ width: `${currentPercent}%` }}
          />
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 35, right: 10, left: 0, bottom: 5 }}
            barCategoryGap="20%"
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
            />
            <YAxis hide domain={[0, 220]} />
            <RechartsTooltip
              content={<CustomTooltip />}
              cursor={{ fill: "transparent" }}
            />

            {/* Current rate bar (dark slate for adjustable, gray for fixed) */}
            <Bar
              dataKey="current"
              stackId="a"
              barSize={50}
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`current-${index}`}
                  fill={entry.isFixed ? "#94a3b8" : "#475569"} // Gray for fixed, dark slate for adjustable
                />
              ))}
              <LabelList
                dataKey="currentDisplay"
                position="insideBottom"
                fill="#ffffff"
                fontSize={11}
                fontWeight={600}
                offset={5}
              />
            </Bar>

            {/* Positive adjustment (green/orange on top) */}
            <Bar
              dataKey="adjustmentPositive"
              stackId="a"
              radius={[6, 6, 0, 0]}
              barSize={50}
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`pos-${index}`}
                  fill={
                    entry.adjustment > 0
                      ? getAdjustmentColor(entry.adjustment)
                      : "transparent"
                  }
                />
              ))}
              <LabelList
                content={(props) => renderAdjustmentLabel(props, "positive")}
              />
            </Bar>

            {/* Negative adjustment (blue segment on top) */}
            <Bar
              dataKey="adjustmentNegative"
              stackId="a"
              radius={[6, 6, 0, 0]}
              barSize={50}
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`neg-${index}`}
                  fill={entry.adjustment < 0 ? "#3b82f6" : "transparent"}
                />
              ))}
              <LabelList
                content={(props) => renderAdjustmentLabel(props, "negative")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-1 flex gap-6 justify-center text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-emerald-500" />
          <span>&gt; +5 t/h</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-orange-500" />
          <span>-5 до +5 t/h</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-blue-500" />
          <span>&lt; -5 t/h</span>
        </div>
      </div>
    </div>
  );
};
