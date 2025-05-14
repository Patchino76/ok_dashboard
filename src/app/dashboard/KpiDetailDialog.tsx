'use client'

import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TagDefinition, TagValue } from "@/lib/tags/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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

// Apply a moving average smoothing to data points
const smoothData = (data: any[], windowSize: number = 3) => {
  if (!data || data.length < windowSize) return data;
  
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    
    // Calculate average of points in the window
    for (let j = Math.max(0, i - Math.floor(windowSize/2)); 
         j <= Math.min(data.length - 1, i + Math.floor(windowSize/2)); 
         j++) {
      if (data[j].value !== undefined && !isNaN(data[j].value)) {
        sum += data[j].value;
        count++;
      }
    }
    
    // Create a new point with the smoothed value
    result.push({
      ...data[i],
      value: count > 0 ? sum / count : data[i].value
    });
  }
  
  return result;
};

// Format trend data for chart with optimized performance
const formatTrendData = (trendPoints: any[], applySmoothing: boolean = false) => {
  if (!trendPoints || !Array.isArray(trendPoints) || trendPoints.length === 0) {
    return [];
  }
  
  // Only process every other data point for large datasets to improve performance
  const shouldFilter = trendPoints.length > 12;
  const filteredPoints = shouldFilter 
    ? trendPoints.filter((_, i) => i % 2 === 0)
    : trendPoints;
  
  // Map the points to the format needed for the chart
  const formattedData = filteredPoints.map(point => {
    // Simple date formatting
    const date = new Date(point.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    return {
      time: formattedTime,
      value: typeof point.value === 'number' ? Number(point.value.toFixed(1)) : 0
    };
  });
  
  // Apply smoothing if requested
  return applySmoothing ? smoothData(formattedData, 15) : formattedData;
}

export function KpiDetailDialog({ definition, value, open, onOpenChange, color = "#0ea5e9" }: KpiDetailDialogProps) {
  if (!definition) return null

  // Track active tab to avoid rendering unused content
  const [activeTab, setActiveTab] = useState("trend");
  const [smoothing, setSmoothing] = useState(false);

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
  const trendData = useMemo(() => formatTrendData(trendPoints || [], smoothing), [trendPoints, smoothing]);

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
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="trend" onClick={() => setActiveTab("trend")}>Тренд (24ч)</TabsTrigger>
                  <TabsTrigger value="details" onClick={() => setActiveTab("details")}>Детали</TabsTrigger>
                </TabsList>
                
                {activeTab === "trend" && (
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="smoothing" className="text-sm">гладко</Label>
                    <Switch 
                      id="smoothing" 
                      checked={smoothing} 
                      onCheckedChange={(checked: boolean) => {
                        console.log('Smoothing changed to:', checked);
                        setSmoothing(checked);
                      }} 
                    />
                  </div>
                )}
              </div>
              
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
                          {/* Show two different line styles based on smoothing toggle */}
                          {!smoothing && (
                            <Line 
                              type="linear"
                              dataKey="value" 
                              stroke={color}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                              isAnimationActive={false}
                            />
                          )}
                          {smoothing && (
                            <Line 
                              type="monotoneX"
                              dataKey="value" 
                              stroke={color}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 5 }}
                              isAnimationActive={false}
                            />
                          )}
                          {/* Add a visual indicator that smoothing is active */}
                          {smoothing && (
                            <text x="50%" y="15" textAnchor="middle" fill="#888" fontSize="12">
                              гладко
                            </text>
                          )}
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
