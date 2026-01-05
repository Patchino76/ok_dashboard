"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { BarDatum } from "../lib/types";

type BarChartCardProps = {
  title: string;
  data: any[];
  barFill?: string;
  useBarColors?: boolean;
  height?: number;
  showLegend?: boolean;
  showTitle?: boolean;
  axisTickFontSize?: number;
  showValueLabels?: boolean;
  yAxisUnit?: string;
  stackedKeys?: string[];
  stackedKeyColors?: Record<string, string>;
  valueDecimals?: number;
};

type RoundedStackSegmentProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: any;
  dataKey: string;
  stackedKeys?: string[];
};

function RoundedStackSegment({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill = "#000",
  payload,
  dataKey,
  stackedKeys,
}: RoundedStackSegmentProps) {
  if (width <= 0 || height <= 0) return null;

  const topKeyFromPayload = payload?.__topKey;
  const fallbackTopKey = stackedKeys?.length
    ? stackedKeys[stackedKeys.length - 1]
    : undefined;
  const isTop = String(topKeyFromPayload ?? fallbackTopKey ?? "") === dataKey;

  if (!isTop) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} />;
  }

  const r = Math.min(8, Math.floor(width / 2), Math.floor(height / 2));

  const d = [
    `M ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height}`,
    `H ${x}`,
    "Z",
  ].join(" ");

  return <path d={d} fill={fill} />;
}

export function BarChartCard({
  title,
  data,
  barFill = "#ec4899",
  useBarColors,
  height = 350,
  showLegend = true,
  showTitle = true,
  axisTickFontSize,
  showValueLabels,
  yAxisUnit,
  stackedKeys,
  stackedKeyColors,
  valueDecimals = 2,
}: BarChartCardProps) {
  const isStacked = Boolean(stackedKeys && stackedKeys.length > 0);

  const formatValue = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(valueDecimals);
  };

  return (
    <div>
      {showTitle ? (
        <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
      ) : null}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="target"
            tick={{ fill: "#6b7280", fontSize: axisTickFontSize }}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: axisTickFontSize }}
            tickFormatter={(v: unknown) => {
              if (!yAxisUnit) return String(v);
              const n = typeof v === "number" ? v : Number(v);
              if (!Number.isFinite(n)) return String(v);
              return `${n.toFixed(valueDecimals)} ${yAxisUnit}`;
            }}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown, props: any) => {
              const v = typeof value === "number" ? value : Number(value);
              const label = typeof name === "string" ? name : "Тонаж";
              const ballType = props?.payload?.ballType;
              const suffix = ballType ? ` (${String(ballType)})` : "";
              const unitSuffix = "";
              return [
                Number.isFinite(v)
                  ? `${v.toFixed(valueDecimals)}${unitSuffix}`
                  : String(value),
                `${label}${suffix}`,
              ];
            }}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          {showLegend ? <Legend /> : null}

          {isStacked ? (
            stackedKeys!.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                name={key}
                stackId="a"
                fill={stackedKeyColors?.[key] || barFill}
                shape={(props: any) => (
                  <RoundedStackSegment
                    {...props}
                    dataKey={key}
                    stackedKeys={stackedKeys}
                  />
                )}
              >
                {showValueLabels && idx === stackedKeys!.length - 1 ? (
                  <LabelList
                    dataKey="__total"
                    position="top"
                    offset={8}
                    formatter={(v: unknown) => {
                      const n = typeof v === "number" ? v : Number(v);
                      if (!Number.isFinite(n)) return "";
                      return n.toFixed(valueDecimals);
                    }}
                    style={{
                      fill: "#111827",
                      fontSize: axisTickFontSize ?? 11,
                    }}
                  />
                ) : null}
              </Bar>
            ))
          ) : (
            <Bar
              dataKey="value"
              name="Тонаж"
              fill={barFill}
              radius={[8, 8, 0, 0]}
            >
              {useBarColors
                ? (data as BarDatum[]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || barFill} />
                  ))
                : null}

              {showValueLabels ? (
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: unknown) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (!Number.isFinite(n)) return "";
                    return n.toFixed(valueDecimals);
                  }}
                  style={{ fill: "#111827", fontSize: axisTickFontSize ?? 11 }}
                />
              ) : null}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
