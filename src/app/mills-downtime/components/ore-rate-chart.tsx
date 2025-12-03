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
}

export function OreRateChart({
  data,
  millId,
  downtimeThreshold = 100,
}: OreRateChartProps) {
  const mill = MILLS.find((m) => m.id === millId);
  const normalFeedRate = mill?.normalFeedRate || 160;

  // Sample data for display (every 2nd point, last 96 points = ~48 hours at 30min intervals)
  const sampledData = data
    .filter((_, i) => i % 2 === 0)
    .slice(-96)
    .map((d) => ({
      ...d,
      time: new Date(d.time).toLocaleString("bg-BG", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
    }));

  // Find min value for Y-axis
  const minValue = Math.min(...sampledData.map((d) => d.feedRate), 0);
  const maxValue = Math.max(
    ...sampledData.map((d) => d.feedRate),
    normalFeedRate + 20
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">
          Разход на руда - {millId.replace("Mill", "MA")}
        </CardTitle>
        <CardDescription>
          Разход на руда за последните 48 часа (цел: {normalFeedRate} t/h)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sampledData}>
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
                dataKey="time"
                stroke="#a1a1aa"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
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
