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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useTagTrend } from "@/hooks"
import { Loader2 } from "lucide-react"
import { calculateRegression, filterValidPoints, generateRegressionLine } from "./utils/trendCalculation"

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

// Format trend data for chart display
const formatTrendData = (trendPoints: any[], applySmoothing: boolean = false) => {
  if (!trendPoints || !Array.isArray(trendPoints) || trendPoints.length === 0) {
    return [];
  }
  
  // Sort points by timestamp to ensure proper display
  const sortedPoints = [...trendPoints].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  // Map the points to the format needed for the chart
  const formattedData = sortedPoints.map(point => {
    // Simple date formatting
    const date = new Date(point.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    // Ensure value is never negative
    const safeValue = typeof point.value === 'number' ? Math.max(0, point.value) : null;
    
    return {
      time: formattedTime,
      value: safeValue
    };
  });
  
  // Apply smoothing if requested
  return applySmoothing ? smoothData(formattedData, 3) : formattedData;
}

export function KpiDetailDialog({ definition, value, open, onOpenChange, color = "#0ea5e9" }: KpiDetailDialogProps) {
  if (!definition) return null

  // Track active tab to avoid rendering unused content
  const [activeTab, setActiveTab] = useState("trend");
  const [smoothing, setSmoothing] = useState(false);

  // Only fetch data when the dialog is actually open
  const { data: trendPoints, loading: trendLoading, error: trendError } = useTagTrend(
    definition?.name || '',
    8, // 24 hours of data
    { 
      enabled: open && !!definition?.name, // Only fetch when dialog is open and we have a tag name
      retry: 1, // Only retry once
      refetchOnMount: false, // Don't refetch automatically to prevent excessive API calls
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    }
  )
  
  // Filter out null values for display and apply scaling if needed
  const validPoints = useMemo(() => {
    const filtered = (trendPoints || []).filter(point => point.value !== null);
    
    // Apply scaling if defined
    if (definition?.scale && filtered.length > 0) {
      return filtered.map(point => ({
        ...point,
        value: point.value !== null ? (point.value as number) * definition.scale! : null
      }));
    }
    
    return filtered;
  }, [trendPoints, definition]);
  
  // Transform data for chart and regression calculation
  const chartData = useMemo(() => {
    if (!validPoints || validPoints.length === 0) return [];
    
    // Convert to the format needed for regression calculation
    return validPoints.map(point => ({
      ...point,
      x: new Date(point.timestamp).getTime(),
      y: point.value as number
    }));
  }, [validPoints]);
  
  // Calculate regression
  const regression = useMemo(() => {
    return chartData.length >= 2 ? calculateRegression(chartData) : null;
  }, [chartData]);
  
  // Generate regression line data
  const regressionLineData = useMemo(() => {
    if (!regression || chartData.length < 2) return [];
    return generateRegressionLine(regression, chartData);
  }, [regression, chartData]);
  
  // Calculate min and max values for proper chart scaling with human-readable values
  const { minValue, maxValue } = useMemo(() => {
    // Combine all data points (both actual data and regression line)
    const allPoints = [...validPoints, ...regressionLineData];
    
    // Extract all numeric values
    const values = allPoints
      .map(point => point.value)
      .filter((value): value is number => typeof value === 'number' && !isNaN(value));
    
    if (values.length === 0) return { minValue: 0, maxValue: 100 };
    
    // Calculate min and max
    let min = Math.min(...values);
    const max = Math.max(...values);
    
    // Never show negative values
    min = Math.max(0, min);
    
    // Calculate the data range
    const range = max - min;
    
    // Determine if we're dealing with very small values (< 0.1)
    const isVerySmallValue = max < 0.1;
    
    // Determine if we have small variations relative to the base value
    // For very small values, we use a different threshold
    const variationThreshold = isVerySmallValue ? 0.5 : 0.1; // 50% for very small values, 10% otherwise
    const isSmallVariation = min > 0 ? (range / min < variationThreshold) : true;
    
    // Adjust padding based on value size and variation
    let paddingPercentage;
    if (isVerySmallValue) {
      // For very small values like 0.038, use minimal padding
      paddingPercentage = 0.1; // 10% padding
    } else if (isSmallVariation) {
      // For normal values with small variations
      paddingPercentage = 0.05; // 5% padding
    } else {
      // For normal values with large variations
      paddingPercentage = 0.2; // 20% padding
    }
    
    const padding = range * paddingPercentage;
    
    // Calculate human-readable min/max that are divisible by nice round numbers
    const roundToNiceNumber = (value: number): number => {
      // Special handling for very small values (< 0.1)
      if (isVerySmallValue) {
        // Determine the magnitude for very small values
        const decimalPlaces = Math.abs(Math.floor(Math.log10(value))) + 1;
        const factor = Math.pow(10, decimalPlaces);
        
        // Round to appropriate decimal places based on magnitude
        return Math.floor(value * factor) / factor;
      }
      
      // Determine the magnitude of the value for normal cases
      const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
      
      // For small variations, use finer-grained rounding
      if (isSmallVariation) {
        if (magnitude >= 1000) {
          return Math.floor(value / 100) * 100;
        } else if (magnitude >= 100) {
          return Math.floor(value / 10) * 10;
        } else if (magnitude >= 10) {
          return Math.floor(value);
        } else if (magnitude >= 1) {
          return Math.floor(value * 10) / 10; // Round to 0.1
        } else if (magnitude >= 0.1) {
          return Math.floor(value * 100) / 100; // Round to 0.01
        } else {
          return Math.floor(value * 1000) / 1000; // Round to 0.001
        }
      } else {
        // Standard rounding for larger variations
        if (magnitude >= 1000) {
          return Math.floor(value / 1000) * 1000;
        } else if (magnitude >= 100) {
          return Math.floor(value / 100) * 100;
        } else if (magnitude >= 10) {
          return Math.floor(value / 10) * 10;
        } else if (magnitude >= 1) {
          return Math.floor(value);
        } else if (magnitude >= 0.1) {
          return Math.floor(value * 10) / 10; // Round to 0.1
        } else {
          return Math.floor(value * 100) / 100; // Round to 0.01
        }
      }
    };
    
    const roundToCeilingNiceNumber = (value: number): number => {
      // Special handling for very small values (< 0.1)
      if (isVerySmallValue) {
        // Determine the magnitude for very small values
        const decimalPlaces = Math.abs(Math.floor(Math.log10(value))) + 1;
        const factor = Math.pow(10, decimalPlaces);
        
        // Round to appropriate decimal places based on magnitude
        return Math.ceil(value * factor) / factor;
      }
      
      // Determine the magnitude of the value for normal cases
      const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
      
      // For small variations, use finer-grained rounding
      if (isSmallVariation) {
        if (magnitude >= 1000) {
          return Math.ceil(value / 100) * 100;
        } else if (magnitude >= 100) {
          return Math.ceil(value / 10) * 10;
        } else if (magnitude >= 10) {
          return Math.ceil(value);
        } else if (magnitude >= 1) {
          return Math.ceil(value * 10) / 10; // Round to 0.1
        } else if (magnitude >= 0.1) {
          return Math.ceil(value * 100) / 100; // Round to 0.01
        } else {
          return Math.ceil(value * 1000) / 1000; // Round to 0.001
        }
      } else {
        // Standard rounding for larger variations
        if (magnitude >= 1000) {
          return Math.ceil(value / 1000) * 1000;
        } else if (magnitude >= 100) {
          return Math.ceil(value / 100) * 100;
        } else if (magnitude >= 10) {
          return Math.ceil(value / 10) * 10;
        } else if (magnitude >= 1) {
          return Math.ceil(value);
        } else if (magnitude >= 0.1) {
          return Math.ceil(value * 10) / 10; // Round to 0.1
        } else {
          return Math.ceil(value * 100) / 100; // Round to 0.01
        }
      }
    };
    
    // Calculate nice round numbers for min and max
    const niceMin = min === 0 ? 0 : roundToNiceNumber(min - padding);
    const niceMax = roundToCeilingNiceNumber(max + padding);
    
    return {
      minValue: niceMin,
      maxValue: niceMax
    };
  }, [validPoints, regressionLineData]);
  
  // Format data for the chart
  const trendData = useMemo(() => formatTrendData(validPoints, smoothing), [validPoints, smoothing]);
  const formattedRegressionData = useMemo(() => formatTrendData(regressionLineData, false), [regressionLineData]);

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
                    : (() => {
                        // Apply scaling if defined
                        const scaledValue = definition.scale && typeof value.value === 'number' 
                          ? value.value * definition.scale 
                          : value.value;
                        return definition.precision !== undefined && typeof scaledValue === 'number'
                          ? Number(scaledValue).toFixed(definition.precision)
                          : scaledValue;
                      })()
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
                    <Label htmlFor="smoothing" className="text-sm">филтър</Label>
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
                          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis 
                            dataKey="time" 
                            tickCount={6} 
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis 
                            width={50} // Slightly wider for small decimal values
                            domain={[Math.max(0, minValue), maxValue]} // Use our calculated min/max values but never go below 0
                            tick={{ fontSize: 10 }}
                            tickCount={5} // Control the number of ticks for better readability
                            tickFormatter={(value) => {
                              // For very small values, show more decimal places
                              if (value < 0.1) {
                                // Use at least 3 decimal places for very small values
                                const precision = Math.max(3, definition.precision || 0);
                                return value.toFixed(precision);
                              }
                              return typeof value === 'number' ? value.toFixed(definition.precision || 0) : value.toString();
                            }}
                            allowDataOverflow={false} // Don't allow data to extend beyond the domain
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'white', borderRadius: '4px', fontSize: '12px', border: '1px solid #ccc' }}
                            formatter={(value: any, name: string) => {
                              // Format the value with appropriate precision
                              const formattedValue = Number(value).toFixed(definition.precision || 0);
                              // Return label based on the data series name
                              return [formattedValue, name === 'regressionValue' ? 'Изчислено' : 'Реално'];
                            }}
                            labelFormatter={(label) => `Час: ${label}`}
                          />
                          
                          {/* Add Legend */}
                          <Legend 
                            verticalAlign="top"
                            height={36}
                            formatter={(value) => value === 'value' ? 'Реално' : 'Изчислено'}
                          />
                          
                          {/* Main data line */}
                          <Line 
                            type={smoothing ? "monotone" : "linear"}
                            dataKey="value" 
                            stroke={color || "#2563eb"} // Blue color as default
                            strokeWidth={2.5} // Slightly thicker for better visibility
                            dot={{ r: 1.5, strokeWidth: 1 }} // Slightly larger dots
                            activeDot={{ r: 5, strokeWidth: 1 }} // Larger active dots
                            connectNulls={false} // Don't connect across null values
                            isAnimationActive={false}
                            name="value"
                          />
                          
                          {/* Regression trend line */}
                          {formattedRegressionData.length > 1 && (
                            <Line 
                              data={formattedRegressionData}
                              type="linear"
                              dataKey="value" 
                              stroke="#ef4444" // Red color
                              strokeDasharray="5 5" // Dashed line
                              strokeWidth={2.5} // Slightly thicker for better visibility
                              dot={false}
                              activeDot={false}
                              isAnimationActive={false}
                              name="regressionValue"
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
