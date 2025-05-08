'use client'

import { ArrowDownRight, ArrowRight, ArrowUpRight, Power } from "lucide-react"
import { Card } from "@/components/ui/card"
import { TagDefinition, TagValue } from "@/lib/tags/types"

type KpiCardProps = {
  definition: TagDefinition
  value: TagValue | null | undefined
  onClick: () => void
}

export function KpiCard({ definition, value, onClick }: KpiCardProps) {
  // Determine if the value is increasing, decreasing, or neutral
  // This would normally come from historical data - using random for demo
  const trend = Math.random() > 0.66 ? "up" : Math.random() > 0.33 ? "down" : "neutral"
  const trendValue = trend === "up" ? "+5%" : trend === "down" ? "-3%" : "0%"
  
  // Map tag groups to colors
  const colorMap: Record<string, string> = {
    "Dispatcher": "border-l-orange-500",
    "Monthly": "border-l-blue-500",
    "Teams": "border-l-emerald-500",
    "KPIs": "border-l-purple-500"
  }
  
  const borderColor = colorMap[definition.group] || "border-l-gray-500"
  
  // Map trend to icons
  const trendIcon = {
    up: <ArrowUpRight className="h-4 w-4 text-emerald-500" />,
    down: <ArrowDownRight className="h-4 w-4 text-red-500" />,
    neutral: <ArrowRight className="h-4 w-4 text-gray-500" />,
  }

  return (
    <Card 
      className={`border-l-4 ${borderColor} shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
      onClick={onClick}
    >
      <div className="p-4">
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
