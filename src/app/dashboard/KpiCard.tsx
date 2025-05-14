'use client'

import React from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Power } from "lucide-react"
import { Card } from "@/components/ui/card"
import { TagDefinition, TagValue } from "@/lib/tags/types"
import { getBorderColorFromGroup } from "@/lib/utils"
import { useTagTrend } from "@/hooks"

type KpiCardProps = {
  definition: TagDefinition
  value: TagValue | null | undefined
  onClick: () => void
}

export function KpiCard({ definition, value, onClick }: KpiCardProps) {
  // Define trend direction type
  type TrendDirection = 'up' | 'down' | 'neutral';
  
  // Limit trend data fetching to only numeric values, and only if we need it
  // This dramatically reduces API calls for cards that don't need trends
  const shouldFetchTrend = typeof value?.value === 'number' && !!definition.name;
  
  // Use a longer stale time to avoid frequent refetching
  const { data: trendPoints } = useTagTrend(
    definition.name,
    4, // Just get 4 hours to calculate trend direction
    { 
      enabled: shouldFetchTrend,
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      retry: 0, // Don't retry to reduce API load
      suspense: false, // Don't use React suspense to avoid UI blocking
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    }
  )
  


  // Calculate trend based on actual data
  const calculateTrend = (): { direction: TrendDirection; percentage: string } => {
    // Default to neutral if no data or not numeric
    if (!trendPoints || trendPoints.length < 2 || typeof value?.value !== 'number') {
      return { direction: 'neutral', percentage: '0%' }
    }
    
    // Get first and last points to calculate trend
    const firstPoint = trendPoints[0]
    const lastPoint = trendPoints[trendPoints.length - 1]
    
    if (firstPoint?.value === null || lastPoint?.value === null) {
      return { direction: 'neutral', percentage: '0%' }
    }
    
    const change = lastPoint.value - firstPoint.value
    const percentChange = firstPoint.value !== 0 
      ? Math.round((change / Math.abs(firstPoint.value)) * 100) 
      : 0
    
    const direction: TrendDirection = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    
    return {
      direction,
      percentage: `${percentChange > 0 ? '+' : ''}${percentChange}%`
    }
  }
  
  const { direction: trend, percentage: trendValue } = calculateTrend()
  
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
