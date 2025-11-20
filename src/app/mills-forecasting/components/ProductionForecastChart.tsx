import { FC } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  Line,
  Rectangle,
} from "recharts";
import type { HourlyForecastPoint, Uncertainty } from "../types/forecasting";

// Custom tooltip formatter - remove decimals
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-xs">
            {entry.name}: <strong>{Math.round(entry.value)} t</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom background component to draw shift zones
const ShiftBackground = (props: any) => {
  const { x, y, width, height } = props;

  // Calculate shift zone widths (each shift is 8 hours out of 24)
  const shiftWidth = width / 3;

  return (
    <g>
      {/* S1: 06:00-14:00 (Blue) */}
      <rect
        x={x}
        y={y}
        width={shiftWidth}
        height={height}
        fill="#dbeafe"
        fillOpacity={0.4}
      />
      <text x={x + 10} y={y + 20} fill="#1e40af" fontSize={12} fontWeight={700}>
        S1
      </text>

      {/* S2: 14:00-22:00 (Orange) */}
      <rect
        x={x + shiftWidth}
        y={y}
        width={shiftWidth}
        height={height}
        fill="#fef3c7"
        fillOpacity={0.4}
      />
      <text
        x={x + shiftWidth + 10}
        y={y + 20}
        fill="#b45309"
        fontSize={12}
        fontWeight={700}
      >
        S2
      </text>

      {/* S3: 22:00-06:00 (Purple) */}
      <rect
        x={x + shiftWidth * 2}
        y={y}
        width={shiftWidth}
        height={height}
        fill="#fae8ff"
        fillOpacity={0.4}
      />
      <text
        x={x + shiftWidth * 2 + 10}
        y={y + 20}
        fill="#6b21a8"
        fontSize={12}
        fontWeight={700}
      >
        S3
      </text>
    </g>
  );
};

interface ProductionForecastChartProps {
  data: HourlyForecastPoint[];
  dayTarget: number;
  uncertainty: Uncertainty;
  expectedStoppages: number;
  expectedDowntime: number;
  currentTime?: Date | null;
}

export const ProductionForecastChart: FC<ProductionForecastChartProps> = ({
  data,
  dayTarget,
  uncertainty,
  expectedStoppages,
  expectedDowntime,
  currentTime,
}) => {
  // Get current hour for vertical line
  const currentHour = currentTime ? currentTime.getHours() : null;
  let currentTimeLabel =
    currentHour !== null ? `${String(currentHour).padStart(2, "0")}:00` : null;

  // Find shift boundaries from actual data points
  const timePoints = data.map((d) => d.time);
  const firstTime = timePoints[0];
  const lastTime = timePoints[timePoints.length - 1];

  // Check if current time exists in data, if not find closest
  if (currentTimeLabel && !timePoints.includes(currentTimeLabel)) {
    console.warn(
      `⚠️ Current time ${currentTimeLabel} not in data, finding closest...`
    );
    // Find closest time point
    const currentHourNum = currentHour!;
    let closestTime = timePoints[0];
    let minDiff = 24;

    timePoints.forEach((time) => {
      const hour = parseInt(time.split(":")[0]);
      const diff = Math.abs(hour - currentHourNum);
      if (diff < minDiff) {
        minDiff = diff;
        closestTime = time;
      }
    });

    currentTimeLabel = closestTime;
    console.log(`✅ Using closest time: ${currentTimeLabel}`);
  }

  console.log("📊 Chart time range:", {
    firstTime,
    lastTime,
    currentTimeLabel,
    currentTimeInData: currentTimeLabel
      ? timePoints.includes(currentTimeLabel)
      : false,
    allTimePoints: timePoints,
  });

  // Calculate NOW line position (as percentage of chart width)
  const nowLinePosition = currentTimeLabel
    ? (() => {
        const currentIndex = timePoints.indexOf(currentTimeLabel);
        if (currentIndex === -1) return null;
        const percentage = (currentIndex / (timePoints.length - 1)) * 100;
        return percentage;
      })()
    : null;

  return (
    <div className="space-y-2">
      <div className="h-72 relative">
        {/* Shift background overlay - aligned with chart plot area */}
        <div
          className="absolute inset-0 flex pointer-events-none"
          style={{
            marginLeft: "50px",
            marginRight: "10px",
            marginTop: "10px",
            marginBottom: "40px",
          }}
        >
          <div className="flex-1 bg-blue-200 opacity-50 flex items-start justify-start pl-3 pt-2">
            <span className="text-blue-900 font-bold text-sm">I смяна</span>
          </div>
          <div className="flex-1 bg-amber-200 opacity-50 flex items-start justify-start pl-3 pt-2">
            <span className="text-amber-900 font-bold text-sm">II смяна</span>
          </div>
          <div className="flex-1 bg-purple-200 opacity-50 flex items-start justify-start pl-3 pt-2">
            <span className="text-purple-900 font-bold text-sm">III смяна</span>
          </div>
        </div>

        {/* NOW line overlay - absolute positioned on top */}
        {nowLinePosition !== null && (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: `calc(50px + ${nowLinePosition}%)`,
              top: "10px",
              bottom: "40px",
              width: "3px",
            }}
          >
            <div
              className="w-full h-full bg-red-600 opacity-80"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 5px, white 5px, white 10px)",
              }}
            />
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">
              сега
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {/* Target line */}
            <ReferenceLine
              y={dayTarget}
              stroke="#3b82f6"
              strokeDasharray="5 5"
              label={{ value: "Target", fontSize: 10, fill: "#3b82f6" }}
            />

            <Area
              type="monotone"
              dataKey="optimistic"
              stroke="none"
              fill="#10b981"
              fillOpacity={0.1}
              name="Optimistic Range"
            />
            <Area
              type="monotone"
              dataKey="pessimistic"
              stroke="none"
              fill="#ef4444"
              fillOpacity={0.1}
              name="Pessimistic Range"
            />

            <Line
              type="monotone"
              dataKey="optimistic"
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              name="Best Case"
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke={uncertainty.color}
              strokeWidth={3}
              dot={false}
              name={`Expected (${uncertainty.name})`}
            />
            <Line
              type="monotone"
              dataKey="pessimistic"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              name="Worst Case"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
        <strong>Note:</strong> Uncertainty range based on{" "}
        {uncertainty.name.toLowerCase()} conditions. Expected scenario: ~
        {expectedStoppages} stoppages, {expectedDowntime.toFixed(0)} min
        downtime.
      </div>
    </div>
  );
};
