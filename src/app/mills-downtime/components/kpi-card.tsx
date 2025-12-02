"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  trendDirection?: "good" | "bad" | "neutral";
  className?: string;
}

export function KPICard({
  title,
  value,
  unit,
  icon,
  change,
  changeLabel,
  trend = "neutral",
  trendDirection = "neutral",
  className,
}: KPICardProps) {
  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="h-3 w-3" />;
    if (trend === "down") return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (trendDirection === "good") return "text-green-500";
    if (trendDirection === "bad") return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {unit && (
            <span className="text-sm text-muted-foreground">{unit}</span>
          )}
        </div>
        {change !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 mt-2 text-xs",
              getTrendColor()
            )}
          >
            {getTrendIcon()}
            <span>
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            {changeLabel && (
              <span className="text-muted-foreground ml-1">{changeLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
