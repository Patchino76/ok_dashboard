'use client'

import React, { useMemo, useState } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock, Power } from "lucide-react"
import { Card } from "@/components/ui/card"
import { TagDefinition, TagValue } from "@/lib/tags/types"
import { FillBar } from "./components/FillBar"
import { cn, getBorderColorFromGroup, getColorFromGroup } from "@/lib/utils"
import { useTagTrend } from "@/hooks"
import { calculateTrend, calculateRegression, generateRegressionLine, TrendDirection, filterValidPoints } from "@/components/charts/trend/trendCalculation"
import { smoothData } from "@/components/charts/trend/trendVisualization"

type KpiCardProps = {
  definition: TagDefinition
  value: TagValue | null | undefined
  onClick: () => void
}

// Import icon utilities
import { renderTagIcon } from "@/lib/utils/kpi/iconUtils";
import { calculateDisplayValue, formatTagValue } from "@/lib/utils/kpi/valueCalculations";

export function KpiCard({ definition, value, onClick }: KpiCardProps) {
  const [isHovering, setIsHovering] = useState(false);

  // Limit trend data fetching to only numeric values, and only if we need it
  const shouldFetchTrend = typeof value?.value === 'number' && !!definition.name;
  
  // Use a longer stale time to avoid frequent refetching
  const { data: trendPoints } = useTagTrend(
    definition.name,
    8, // Get 8 hours of data for trend calculation
    { 
      enabled: shouldFetchTrend,
      staleTime: 5 * 60 * 1000,
      retry: 0,
      suspense: false,
      refetchOnWindowFocus: false,
    }
  )
  
  // Calculate trend and regression data
  const { direction: trend, percentage: trendValue } = calculateTrend(trendPoints)
  const validPoints = filterValidPoints(trendPoints);
  
  // Get group color for styling
  const groupColor = getColorFromGroup(definition.group);
  const borderColorClass = getBorderColorFromGroup(definition.group);
  
  // Format value with proper scaling and precision
  const formattedValue = useMemo(() => {
    if (value?.value === null || value?.value === undefined) return 'N/A';
    
    if (typeof value.value === 'boolean') {
      return value.value ? 'Active' : 'Inactive';
    }
    
    if (typeof value.value === 'number') {
      const scaledValue = definition.scale ? value.value * definition.scale : value.value;
      return definition.precision !== undefined
        ? scaledValue.toFixed(definition.precision)
        : scaledValue;
    }
    
    return value.value;
  }, [value, definition.scale, definition.precision]);

  // Calculate percentage for progress bar
  const percentage = useMemo(() => {
    if (typeof value?.value !== 'number' || !definition.maxValue) return 0;
    return Math.min(Math.round((value.value / definition.maxValue) * 100), 100);
  }, [value?.value, definition.maxValue]);
  
  // Format timestamp
  const timeDisplay = useMemo(() => {
    if (!value?.timestamp) return 'No timestamp';
    return new Date(value.timestamp).toLocaleTimeString();
  }, [value?.timestamp]);
  
  // Generate sparkline data from trend points with smoothing
  const sparklineData = useMemo(() => {
    if (!validPoints || validPoints.length < 2) return [];
    
    // Format points for smoothing
    const dataPoints = validPoints.map(p => ({
      value: p.value as number,
      timestamp: p.timestamp
    }));
    
    // Apply smoothing with window size of 15
    const smoothedPoints = smoothData(dataPoints, 15);
    
    // Extract just the values for the sparkline
    return smoothedPoints.map(p => p.value as number);
  }, [validPoints]);
  
  // Generate sparkline path
  const generateSparklinePath = () => {
    if (!sparklineData.length) return "";
    
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    
    const width = 100;
    const height = 30;
    const padding = 2;
    
    const points = sparklineData.map((value, index) => {
      const x = (index / (sparklineData.length - 1)) * width;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });
    
    return `M${points.join(" L")}`;
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer",
        borderColorClass
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={onClick}
    >
      {/* Animated gradient background on hover */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-300",
          isHovering && "opacity-100"
        )}
        style={{
          background: `linear-gradient(to right, ${groupColor}10, transparent)`
        }}
      />

      <div className="relative p-4">
        {/* Header with title and status */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm text-gray-800 pr-6">{definition.desc}</h3>
          
          {definition.state && definition.state.length > 0 && (
            <div className={cn("rounded-full p-1.5", value?.active ? "bg-green-500/10" : "bg-red-500/10")}>
              <Power 
                className={cn("h-3 w-3", value?.active ? "text-green-500" : "text-red-500")} 
              />
            </div>
          )}
        </div>

        {/* Main value, icon and trend */}
        <div className="flex items-baseline gap-2 mb-1">
          {definition.icon && (
            <div className="flex items-center text-gray-500 mr-1" style={{ marginBottom: '2px' }}>
              {renderTagIcon(definition.icon)}
            </div>
          )}
          <span className="text-3xl font-bold text-gray-900">{formattedValue}</span>
          <span className="text-sm text-gray-500">{definition.unit}</span>
          
          {trendValue && (
            <div
              className={cn(
                "flex items-center text-xs font-medium",
                trend === "up" ? "text-emerald-500" : 
                trend === "down" ? "text-red-500" : "text-gray-400"
              )}
            >
              {trend === "up" ? (
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
              ) : trend === "down" ? (
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5 rotate-180" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 mr-0.5" />
              )}
              {trend === "up" ? "+" : ""}
              {trendValue}
            </div>
          )}
        </div>

        {/* Sparkline - Always maintain height for consistent layout */}
        <div className="h-8 mb-1">
          {typeof value?.value === 'number' && sparklineData.length > 1 ? (
            <svg width="100%" height="100%" viewBox="0 0 100 30" preserveAspectRatio="none">
              <path
                d={generateSparklinePath()}
                fill="none"
                stroke={groupColor}
                strokeWidth="1.0"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Fill area under the sparkline with gradient */}
              <path 
                d={`${generateSparklinePath()} L100,30 L0,30 Z`} 
                fill={`url(#sparkline-gradient-${definition.id})`} 
                opacity="0.2" 
              />
              <defs>
                <linearGradient id={`sparkline-gradient-${definition.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={groupColor} />
                  <stop offset="100%" stopColor={groupColor} stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          ) : null}
        </div>

        {/* FillBar - Always maintain height for consistent layout */}
        <div className="mb-1 min-h-[28px] mt-4">
          {typeof value?.value === 'number' && definition.maxValue ? (
            <FillBar
              currentValue={definition.scale ? value.value * definition.scale : value.value}
              maxValue={definition.maxValue}
              height={8}
              barColorClass="bg-slate-500"
              backgroundColorClass="bg-gray-200"
              unit={definition.unit}
              inverse={definition.inverse}
            />
          ) : null}
        </div>
      </div>
    </Card>
  )
}
