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
              const unitSuffix = yAxisUnit ? ` ${yAxisUnit}` : "";
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
                radius={idx === stackedKeys!.length - 1 ? [8, 8, 0, 0] : 0}
              >
                {showValueLabels && idx === stackedKeys!.length - 1 ? (
                  <LabelList
                    dataKey="__total"
                    position="top"
                    offset={8}
                    formatter={(v: unknown) => {
                      const n = typeof v === "number" ? v : Number(v);
                      if (!Number.isFinite(n)) return "";
                      return yAxisUnit
                        ? `${n.toFixed(valueDecimals)} ${yAxisUnit}`
                        : n.toFixed(valueDecimals);
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
                    return yAxisUnit
                      ? `${n.toFixed(valueDecimals)} ${yAxisUnit}`
                      : n.toFixed(valueDecimals);
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
