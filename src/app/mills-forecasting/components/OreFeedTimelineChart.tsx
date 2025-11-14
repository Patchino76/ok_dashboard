import { FC } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { OreFeedTimelinePoint } from "../types/forecasting";

interface OreFeedTimelineChartProps {
  data: OreFeedTimelinePoint[];
}

export const OreFeedTimelineChart: FC<OreFeedTimelineChartProps> = ({
  data,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-[11px] text-slate-500">
        No ore feed timeline data available.
      </div>
    );
  }

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="actualRate"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={false}
            name="Actual t/h"
          />
          <Line
            type="monotone"
            dataKey="requiredShiftRate"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            name="Required Shift t/h"
          />
          <Line
            type="monotone"
            dataKey="requiredDayRate"
            stroke="#a855f7"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            name="Required Day t/h"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
