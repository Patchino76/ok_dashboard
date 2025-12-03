"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  ReferenceArea,
} from "recharts";
import { MILLS } from "../lib/downtime-utils";

interface OreRateChartProps {
  data: Array<{
    time: string;
    feedRate: number;
  }>;
  millId: string;
  downtimeThreshold?: number;
  days?: number;
}

export function OreRateChart({
  data,
  millId,
  downtimeThreshold = 100,
  days = 30,
}: OreRateChartProps) {
  const mill = MILLS.find((m) => m.id === millId);
  const normalFeedRate = mill?.normalFeedRate || 160;

  // Use the same time range as the timeline chart
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Filter data to only include points within the time range
  const filteredData = data.filter((d) => {
    const pointDate = new Date(d.time);
    return pointDate >= startDate && pointDate <= now;
  });

  // Smart sampling that preserves peaks and valleys (especially downtimes)
  // This ensures we don't miss drops to 0 even with large datasets
  const targetPoints = 400; // Increased for better resolution

  const smartSample = (data: typeof filteredData): typeof filteredData => {
    if (data.length <= targetPoints) return data;

    const result: typeof filteredData = [];
    const bucketSize = Math.floor(data.length / targetPoints);

    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, Math.min(i + bucketSize, data.length));
      if (bucket.length === 0) continue;

      // Find min and max in this bucket
      let minPoint = bucket[0];
      let maxPoint = bucket[0];

      for (const point of bucket) {
        if (point.feedRate < minPoint.feedRate) minPoint = point;
        if (point.feedRate > maxPoint.feedRate) maxPoint = point;
      }

      // Always include both min and max to preserve the shape
      // Add them in chronological order
      const minTime = new Date(minPoint.time).getTime();
      const maxTime = new Date(maxPoint.time).getTime();

      if (minPoint === maxPoint) {
        result.push(minPoint);
      } else if (minTime < maxTime) {
        result.push(minPoint);
        result.push(maxPoint);
      } else {
        result.push(maxPoint);
        result.push(minPoint);
      }
    }

    return result;
  };

  // Sample data for display - preserving peaks and valleys
  const sampledData = smartSample(filteredData).map((d) => {
    const date = new Date(d.time);
    return {
      ...d,
      // Store original timestamp for tooltip
      fullTime: date.toLocaleString("bg-BG", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      // Store numeric timestamp for proper x-axis scaling
      timestamp: date.getTime(),
      // Shorter format for display
      timeLabel: date.toLocaleDateString("bg-BG", {
        day: "numeric",
        month: "short",
      }),
    };
  });

  // Find min/max values for Y-axis
  const feedRates = sampledData.map((d) => d.feedRate);
  const minValue = feedRates.length > 0 ? Math.min(...feedRates, 0) : 0;
  const maxValue =
    feedRates.length > 0
      ? Math.max(...feedRates, normalFeedRate + 20)
      : normalFeedRate + 20;

  // Generate fixed x-axis ticks to match timeline chart
  const tickCount = 7;
  const timeRange = now.getTime() - startDate.getTime();
  const tickInterval = timeRange / tickCount;
  const xAxisTicks = Array.from(
    { length: tickCount + 1 },
    (_, i) => startDate.getTime() + i * tickInterval
  );

  // Format tick values for display
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("bg-BG", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">
          Разход на руда - {millId.replace("Mill", "MA")}
        </CardTitle>
        <CardDescription>
          Разход на руда за последните {days} дни (цел: {normalFeedRate} t/h)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={sampledData}
              margin={{ top: 10, right: 60, left: 10, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="feedRateGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={[startDate.getTime(), now.getTime()]}
                ticks={xAxisTicks}
                tickFormatter={formatXAxis}
                stroke="#a1a1aa"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={40}
                domain={[minValue, maxValue]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "#e5e7eb" }}
                itemStyle={{ color: "#e5e7eb" }}
                labelFormatter={(timestamp) => {
                  const date = new Date(timestamp);
                  return date.toLocaleString("bg-BG", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                }}
                formatter={(value: number) => [
                  `${value.toFixed(0)} t/h`,
                  "Разход",
                ]}
              />
              {/* Downtime zone (below threshold) */}
              <ReferenceArea
                y1={0}
                y2={downtimeThreshold}
                fill="#ef4444"
                fillOpacity={0.1}
              />
              {/* Target line */}
              <ReferenceLine
                y={normalFeedRate}
                stroke="#22c55e"
                strokeDasharray="5 5"
                label={{
                  value: "Цел",
                  position: "right",
                  fill: "#22c55e",
                  fontSize: 11,
                }}
              />
              {/* Downtime threshold line */}
              <ReferenceLine
                y={downtimeThreshold}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: "Праг",
                  position: "right",
                  fill: "#ef4444",
                  fontSize: 11,
                }}
              />
              <Area
                type="stepAfter"
                dataKey="feedRate"
                stroke="#f97316"
                fill="url(#feedRateGradient)"
                strokeWidth={2}
                name="Разход (t/h)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
