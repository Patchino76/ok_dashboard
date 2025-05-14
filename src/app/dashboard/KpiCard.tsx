'use client'

import React from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Power } from "lucide-react"
import { Card } from "@/components/ui/card"
import { TagDefinition, TagValue } from "@/lib/tags/types"
import { getBorderColorFromGroup } from "@/lib/utils"
import { useTagTrend } from "@/hooks"
import { Sparkline } from "./components/Sparkline"
import { calculateTrend, calculateRegression, generateRegressionLine, TrendDirection, filterValidPoints } from "./utils/trendCalculation"

type KpiCardProps = {
  definition: TagDefinition
  value: TagValue | null | undefined
  onClick: () => void
}

export function KpiCard({ definition, value, onClick }: KpiCardProps) {
  // Limit trend data fetching to only numeric values, and only if we need it
  // This dramatically reduces API calls for cards that don't need trends
  const shouldFetchTrend = typeof value?.value === 'number' && !!definition.name;
  
  // Use a longer stale time to avoid frequent refetching
  const { data: trendPoints } = useTagTrend(
    definition.name,
    8, // Get 8 hours of data for trend calculation
    { 
      enabled: shouldFetchTrend,
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      retry: 0, // Don't retry to reduce API load
      suspense: false, // Don't use React suspense to avoid UI blocking
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    }
  )
  
  // Use the extracted utility function to calculate trend
  const { direction: trend, percentage: trendValue } = calculateTrend(trendPoints)
  
  // Calculate regression line data for the sparkline
  const validPoints = filterValidPoints(trendPoints);
  const regression = validPoints.length >= 2 ? calculateRegression(validPoints) : null;
  const regressionLineData = regression ? generateRegressionLine(regression, validPoints) : []
  
  // Get border color class from group name using utility function
  const borderColor = getBorderColorFromGroup(definition.group);
  
  // Map trend to icons
  const trendIcon: Record<'up' | 'down' | 'neutral', React.ReactNode> = {
    up: <ArrowUpRight className="h-4 w-4 text-emerald-500" />,
    down: <ArrowDownRight className="h-4 w-4 text-red-500" />,
    neutral: <ArrowRight className="h-4 w-4 text-gray-500" />,
  }

  return (
    <Card 
      className={`border-l-4 ${borderColor} shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
      onClick={onClick}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between pb-2">
          <h3 className="font-medium text-sm">{definition.desc}</h3>
          {definition.state && definition.state.length > 0 && (
            <div className="flex items-center">
              <Power className={`h-4 w-4 mr-1 ${value?.active ? 'text-green-500' : 'text-red-500'}`} />
            </div>
          )}
        </div>
        
        {/* <div className="text-xs text-muted-foreground">{definition.name}</div> */}
        
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold">
            {value?.value !== null && value?.value !== undefined
              ? typeof value.value === 'boolean'
                ? value.value ? 'Active' : 'Inactive'
                : typeof value.value === 'number'
                  ? definition.precision !== undefined
                    ? value.value.toFixed(definition.precision)
                    : value.value
                  : value.value
              : 'N/A'}
          </span>
          
          <span className="text-sm text-muted-foreground">{definition.unit}</span>
          
          <div className="flex items-center text-xs ml-2">
            {trendIcon[trend]}
            <span 
              className={trend === "up" 
                ? "ml-1 text-emerald-500" 
                : trend === "down" 
                ? "ml-1 text-red-500" 
                : "ml-1 text-gray-500"}
            >
              {trendValue}
            </span>
            {/* Only show sparkline for numeric values with trend data */}
            {typeof value?.value === 'number' && trendPoints && trendPoints.length > 1 && (
              <Sparkline 
                data={trendPoints} 
                color={trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280"} 
                className="ml-2"
                showRegressionLine={true}
                regressionLineData={regressionLineData}
                regressionLineColor={trend === "up" ? "rgba(16, 185, 129, 0.5)" : trend === "down" ? "rgba(239, 68, 68, 0.5)" : "rgba(107, 114, 128, 0.5)"}
              />
            )}
          </div>
        </div>
        
        <div className="mt-3 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {value?.timestamp 
              ? new Date(value.timestamp).toLocaleTimeString() 
              : 'No timestamp'}
          </span>
          
          <button 
            className="text-xs text-primary flex items-center hover:underline"
          >
            View Details
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </button>
        </div>
      </div>
    </Card>
  )
}
