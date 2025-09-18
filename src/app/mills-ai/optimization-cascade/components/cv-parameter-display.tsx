"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface CVParameterDisplayProps {
  id: string
  name: string
  unit: string
  predictedValue: number | null
  previousValue?: number | null
  bounds?: [number, number]
  isViolated?: boolean
  className?: string
}

export function CVParameterDisplay({
  id,
  name,
  unit,
  predictedValue,
  previousValue,
  bounds,
  isViolated = false,
  className = ""
}: CVParameterDisplayProps) {
  // Calculate trend
  const getTrend = () => {
    if (predictedValue === null || previousValue === null || previousValue === undefined) {
      return null;
    }
    const diff = predictedValue - previousValue;
    if (Math.abs(diff) < 0.01) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  const trend = getTrend();

  // Check if value is in bounds
  const isInBounds = bounds ? (
    predictedValue !== null && 
    predictedValue >= bounds[0] && 
    predictedValue <= bounds[1]
  ) : true;

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Minus className="h-4 w-4 text-slate-600" />;
      default: return null;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      case 'stable': return 'text-slate-600';
      default: return 'text-slate-400';
    }
  };

  // CV styling (blue theme)
  const style = {
    cardBg: "bg-gradient-to-br from-white to-blue-50/90 dark:from-slate-800 dark:to-blue-900/30",
    topBar: "from-blue-500 to-cyan-500",
    ring: isViolated 
      ? "ring-2 ring-red-300/80 dark:ring-red-900/60" 
      : "ring-2 ring-blue-200/80 dark:ring-blue-900/60",
    badgeColor: isViolated 
      ? "bg-red-100 text-red-800 border-red-200"
      : "bg-blue-100 text-blue-800 border-blue-200",
    iconColor: "text-blue-600"
  };

  return (
    <Card className={`shadow-lg border-0 ${style.cardBg} ${style.ring} backdrop-blur-sm overflow-hidden h-[200px] flex flex-col ${className}`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${style.topBar}`} />

      <CardHeader className="pb-2 flex-shrink-0">
        <div className="text-center">
          <CardTitle className="text-sm font-medium flex flex-col items-center gap-1">
            <span className={`text-lg ${style.iconColor}`}>📊</span>
            <span className="text-xs leading-tight">{name}</span>
          </CardTitle>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${style.badgeColor}`}>
              CV
            </Badge>
            {isViolated && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 bg-red-100 text-red-800 border-red-200">
                Violated
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col items-center justify-center">
        {/* Predicted Value Display */}
        <div className="text-center mb-2">
          <div className={`text-2xl font-bold ${
            isViolated ? 'text-red-600' : 'text-blue-600'
          }`}>
            {predictedValue !== null ? predictedValue.toFixed(2) : '--'}
          </div>
          <div className="text-xs text-slate-500">{unit}</div>
        </div>

        {/* Trend Indicator */}
        {trend && (
          <div className={`flex items-center gap-1 mb-2 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-xs font-medium">
              {trend === 'up' ? 'Increasing' : trend === 'down' ? 'Decreasing' : 'Stable'}
            </span>
          </div>
        )}

        {/* Bounds Display */}
        {bounds && (
          <div className="text-center text-xs text-slate-500">
            <div className={`${isInBounds ? 'text-green-600' : 'text-red-600'} font-medium`}>
              {isInBounds ? 'In Bounds' : 'Out of Bounds'}
            </div>
            <div>Range: {bounds[0].toFixed(1)} - {bounds[1].toFixed(1)}</div>
          </div>
        )}

        {/* Status Indicator */}
        <div className="mt-2">
          <div className={`w-3 h-3 rounded-full ${
            predictedValue === null 
              ? 'bg-slate-300' 
              : isViolated 
              ? 'bg-red-500' 
              : isInBounds 
              ? 'bg-green-500' 
              : 'bg-yellow-500'
          }`} />
        </div>
      </CardContent>
    </Card>
  );
}
