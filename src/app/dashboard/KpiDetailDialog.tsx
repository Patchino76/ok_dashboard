'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TagDefinition, TagValue } from "@/lib/tags/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useTagTrend } from "@/hooks"
import { Loader2 } from "lucide-react"

type KpiDetailDialogProps = {
  definition: TagDefinition | null
  value: TagValue | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  color?: string // Color for the trend line, derived from the group
}

// Format trend data for chart with optimized performance
const formatTrendData = (trendPoints: any[]) => {
  if (!trendPoints || !Array.isArray(trendPoints) || trendPoints.length === 0) {
    return [];
  }
  
  // Only process every other data point for large datasets to improve performance
  const shouldFilter = trendPoints.length > 12;
  const filteredPoints = shouldFilter 
    ? trendPoints.filter((_, i) => i % 2 === 0)
    : trendPoints;
  
  // Optimize date formatting by avoiding excessive Date object creation
  return filteredPoints.map(point => {
    // Simple time format without seconds for better performance
    const date = new Date(point.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    return {
      time: formattedTime,
      value: typeof point.value === 'number' ? Number(point.value.toFixed(1)) : 0
    };
  });
}

export function KpiDetailDialog({ definition, value, open, onOpenChange, color = "#0ea5e9" }: KpiDetailDialogProps) {
  if (!definition) return null

  // Only fetch data when the dialog is actually open
  const { data: trendPoints, loading: trendLoading, error: trendError } = useTagTrend(
    definition?.name || '',
    24, // 24 hours of data
    { 
      enabled: open && !!definition?.name, // Only fetch when dialog is open and we have a tag name
      retry: 1, // Only retry once
      refetchOnMount: false, // Don't refetch automatically to prevent excessive API calls
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    }
  )
  
  // Use memoization to prevent excessive recalculations
  const trendData = useMemo(() => formatTrendData(trendPoints || []), [trendPoints]);
  
  // Track active tab to avoid rendering unused content
  const [activeTab, setActiveTab] = useState("trend");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            {definition.desc}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">Current Value</h3>
              <div className="mt-2 text-2xl font-bold">
                {value?.value !== null && value?.value !== undefined
                  ? typeof value.value === 'boolean'
                    ? value.value ? 'Active' : 'Inactive'
                    : value.value
                  : 'N/A'} 
                <span className="text-sm text-muted-foreground ml-1">{definition.unit}</span>
              </div>
            </div>
            
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">Unit</h3>
              <div className="mt-2 text-2xl font-bold">
                {definition.unit}
              </div>
            </div>
            
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">Last Update</h3>
              <div className="mt-2 text-xl font-bold">
                {value?.timestamp 
                  ? new Date(value.timestamp).toLocaleTimeString() 
                  : 'No data'}
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border p-4">
            <Tabs defaultValue="trend">
              <TabsList className="mb-4">
                <TabsTrigger value="trend" onClick={() => setActiveTab("trend")}>Trend (24h)</TabsTrigger>
                <TabsTrigger value="details" onClick={() => setActiveTab("details")}>Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="trend">
                <div className="h-[300px]">
                  {/* Only render chart content when the trend tab is active */}
                  {activeTab === "trend" && (
                    trendLoading ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading trend data...</span>
                      </div>
                    ) : trendError ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-red-500">Error loading trend data</p>
                      </div>
                    ) : trendData.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-muted-foreground">No trend data available</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={trendData}
                          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                          <XAxis dataKey="time" tickCount={6} />
                          <YAxis width={40} />
                          <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '4px' }} />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            dot={false} // Remove dots for better performance
                            activeDot={{ r: 4 }} // Show dots only on hover
                            isAnimationActive={false} // Disable animations for better performance
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="details">
                {/* Only render detail content when the details tab is active */}
                {activeTab === "details" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-1">ID</h4>
                        <p className="text-muted-foreground">{definition.id}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Name</h4>
                        <p className="text-muted-foreground">{definition.name}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Group</h4>
                        <p className="text-muted-foreground">{definition.group}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Unit</h4>
                        <p className="text-muted-foreground">{definition.unit}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-1">Description</h4>
                      <p className="text-muted-foreground">{definition.desc}</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
