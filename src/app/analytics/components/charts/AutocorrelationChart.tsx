"use client";
import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

interface AutocorrelationChartProps {
  data: number[];
  maxLag?: number;
  title?: string;
  confidenceLevel?: number;
}

interface ACFDataPoint {
  lag: number;
  acf: number;
  isSignificant: boolean;
}

export const AutocorrelationChart: React.FC<AutocorrelationChartProps> = ({
  data,
  maxLag = 20,
  title = "Автокорелация (ACF)",
  confidenceLevel = 0.95,
}) => {
  const { acfData, confidenceBound } = useMemo(() => {
    if (!data || data.length < 10) {
      return { acfData: [], confidenceBound: 0 };
    }

    const validData = data.filter((v) => !isNaN(v) && isFinite(v));
    const n = validData.length;

    if (n < 10) {
      return { acfData: [], confidenceBound: 0 };
    }

    // Calculate mean
    const mean = validData.reduce((sum, v) => sum + v, 0) / n;

    // Calculate variance (denominator for ACF)
    const variance = validData.reduce(
      (sum, v) => sum + Math.pow(v - mean, 2),
      0
    );

    // Calculate autocorrelation for each lag
    const acfData: ACFDataPoint[] = [];
    const effectiveMaxLag = Math.min(maxLag, Math.floor(n / 4));

    // 95% confidence bound (approximately 1.96 / sqrt(n))
    const zValue = confidenceLevel === 0.95 ? 1.96 : 2.576; // 95% or 99%
    const confidenceBound = zValue / Math.sqrt(n);

    for (let lag = 0; lag <= effectiveMaxLag; lag++) {
      let numerator = 0;
      for (let t = 0; t < n - lag; t++) {
        numerator += (validData[t] - mean) * (validData[t + lag] - mean);
      }
      const acf = variance > 0 ? numerator / variance : 0;

      acfData.push({
        lag,
        acf,
        isSignificant: lag > 0 && Math.abs(acf) > confidenceBound,
      });
    }

    return { acfData, confidenceBound };
  }, [data, maxLag, confidenceLevel]);

  if (acfData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Недостатъчно данни за автокорелационен анализ (мин. 10 точки)
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload as ACFDataPoint;
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-gray-800">Лаг {point.lag}</p>
        <p className="text-sm text-gray-600">
          ACF: <span className="font-medium">{point.acf.toFixed(4)}</span>
        </p>
        {point.isSignificant && (
          <p className="text-xs text-blue-600 mt-1">✓ Статистически значим</p>
        )}
      </div>
    );
  };

  // Detect seasonality patterns
  const significantLags = acfData.filter((d) => d.lag > 0 && d.isSignificant);
  const hasSeasonality = significantLags.length > 0;
  const dominantLag =
    significantLags.length > 0
      ? significantLags.reduce((max, curr) =>
          Math.abs(curr.acf) > Math.abs(max.acf) ? curr : max
        )
      : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <div className="flex gap-2 text-xs">
          {hasSeasonality ? (
            <span className="text-blue-600 font-medium">
              🔄 Сезонност при лаг {dominantLag?.lag}
            </span>
          ) : (
            <span className="text-green-600 font-medium">
              ✓ Без значима автокорелация
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={acfData}
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.3}
            />
            <XAxis
              dataKey="lag"
              tick={{ fontSize: 10 }}
              label={{
                value: "Лаг",
                position: "bottom",
                fontSize: 10,
                offset: -5,
              }}
            />
            <YAxis
              domain={[-1, 1]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Confidence bounds */}
            <ReferenceLine
              y={confidenceBound}
              stroke="#94a3b8"
              strokeDasharray="5 5"
            />
            <ReferenceLine
              y={-confidenceBound}
              stroke="#94a3b8"
              strokeDasharray="5 5"
            />
            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />

            <Bar dataKey="acf" radius={[2, 2, 0, 0]}>
              {acfData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.lag === 0
                      ? "#94a3b8"
                      : entry.isSignificant
                      ? "#3b82f6"
                      : "#cbd5e1"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interpretation */}
      <div className="flex justify-center gap-4 mt-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>Значим (извън {(confidenceLevel * 100).toFixed(0)}% CI)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-slate-300 rounded" />
          <span>Незначим</span>
        </div>
      </div>
    </div>
  );
};
