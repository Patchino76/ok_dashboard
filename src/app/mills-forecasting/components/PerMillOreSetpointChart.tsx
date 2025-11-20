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
} from "recharts";
import type { PerMillSetpoint } from "../types/forecasting";

interface PerMillOreSetpointChartProps {
  data: PerMillSetpoint[];
}

interface ChartPoint {
  name: string;
  current: number; // Current ore rate (dark bar)
  adjustmentPositive: number; // Positive adjustment (green/orange on top)
  adjustmentNegative: number; // Negative adjustment (red notch)
  adjustment: number; // Raw adjustment value
  currentDisplay: string;
  adjustmentDisplay: string;
}

// Color thresholds based on images
const getAdjustmentColor = (adjustment: number): string => {
  if (Math.abs(adjustment) <= 5) return "#ef4444"; // Red: Small/negative
  if (Math.abs(adjustment) <= 10) return "#f97316"; // Orange: Moderate
  return "#10b981"; // Green: Strong change
};

const getAdjustmentLabel = (adjustment: number): string => {
  const rounded = Math.round(adjustment);
  if (rounded === 0) return "0 t/h";
  return `${rounded > 0 ? "+" : ""}${rounded} t/h`;
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

      return {
        name,
        current: current, // Always show full current rate
        adjustmentPositive: adjustment > 0 ? adjustment : 0, // Green/orange on top for positive
        adjustmentNegative: adjustment < 0 ? Math.abs(adjustment) : 0, // Red segment on top for negative
        adjustment, // Raw value for color logic
        currentDisplay: String(Math.round(current)),
        adjustmentDisplay: getAdjustmentLabel(adjustment),
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

  // Custom label for adjustment values at the top of background bar
  const renderAdjustmentLabel = (props: any) => {
    const { x, width, index } = props;
    const point = chartData[index];
    if (!point || point.adjustment === 0) return <g />;

    const centerX = x + width / 2;
    const color = getAdjustmentColor(point.adjustment);

    // Position at top of chart (fixed y position)
    return (
      <text
        x={centerX}
        y={15} // Fixed position at top
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
      const current = Math.round(parseFloat(p.currentDisplay));
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

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 35, right: 10, left: 0, bottom: 5 }}
          barCategoryGap="20%"
        >
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
          />
          <YAxis hide />
          <RechartsTooltip
            content={<CustomTooltip />}
            cursor={{ fill: "transparent" }}
          />

          {/* Current rate bar (dark slate) */}
          <Bar
            dataKey="current"
            stackId="a"
            fill="#475569"
            radius={[0, 0, 6, 6]}
            barSize={50}
          >
            <LabelList
              dataKey="currentDisplay"
              position="center"
              style={{ fill: "white", fontSize: 13, fontWeight: 600 }}
            />
          </Bar>

          {/* Positive adjustment (green/orange on top) */}
          <Bar
            dataKey="adjustmentPositive"
            stackId="a"
            radius={[6, 6, 0, 0]}
            barSize={50}
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
            <LabelList content={renderAdjustmentLabel} />
          </Bar>

          {/* Negative adjustment (red segment on top) */}
          <Bar
            dataKey="adjustmentNegative"
            stackId="a"
            radius={[6, 6, 0, 0]}
            barSize={50}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`neg-${index}`}
                fill={entry.adjustment < 0 ? "#ef4444" : "transparent"}
              />
            ))}
            <LabelList content={renderAdjustmentLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex gap-6 justify-center text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-emerald-500" />
          <span>Strong change</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-orange-500" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-red-500" />
          <span>Small / negative</span>
        </div>
      </div>
    </div>
  );
};
