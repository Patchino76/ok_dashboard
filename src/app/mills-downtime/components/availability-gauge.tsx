"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AvailabilityGaugeProps {
  value: number;
  title: string;
  className?: string;
}

export function AvailabilityGauge({
  value,
  title,
  className,
}: AvailabilityGaugeProps) {
  const getColor = () => {
    if (value >= 95) return { stroke: "#22c55e", bg: "bg-green-500/20" };
    if (value >= 85) return { stroke: "#eab308", bg: "bg-yellow-500/20" };
    return { stroke: "#ef4444", bg: "bg-red-500/20" };
  };

  const { stroke, bg } = getColor();
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardContent className="p-4 flex flex-col items-center">
        <div className="relative w-28 h-28">
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 100 100"
          >
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={stroke}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-foreground">
              {value.toFixed(1)}%
            </span>
          </div>
        </div>
        <span className="mt-2 text-sm text-muted-foreground text-center">
          {title}
        </span>
      </CardContent>
    </Card>
  );
}
