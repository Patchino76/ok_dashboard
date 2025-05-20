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
import { Loader2, ArrowLeft, X, Clock } from "lucide-react"
import { calculateRegression, filterValidPoints, generateRegressionLine } from "./utils/trendCalculation"
import { smoothData, formatTrendData, calculateAxisBounds, formatYAxisTick } from "./utils/trendVisualization"
import { TimeRangeSelector, TimeRange } from "./components/TimeRangeSelector"
import { getHoursFromTimeRange, getTimeRangeLabel } from "@/lib/utils/kpi/timeUtils"
import { LoadingSpinner } from "./components/LoadingSpinner"
import { StatisticsView } from "./components/StatisticsView"

type KpiDetailDialogProps = {
  definition: TagDefinition | null
  value: TagValue | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  color?: string // Color for the trend line, derived from the group
}

export function KpiDetailDialog({ definition, value, open, onOpenChange, color = "#0ea5e9" }: KpiDetailDialogProps) {
  if (!definition) return null

  // Track active tab to avoid rendering unused content
  const [activeTab, setActiveTab] = useState("trend");
  const [smoothing, setSmoothing] = useState(true);
  const [isSmoothing, setIsSmoothing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('8h');
  const [isChangingTimeRange, setIsChangingTimeRange] = useState(false);

  // Calculate hours from selected time range
  const hours = getHoursFromTimeRange(selectedTimeRange);

  // Handle time range changes
  const handleTimeRangeChange = (newRange: TimeRange) => {
    setIsChangingTimeRange(true);
    setSelectedTimeRange(newRange);
    
    // Clear the loading state after a short delay to allow the next fetch to start
    setTimeout(() => {
      setIsChangingTimeRange(false);
    }, 100);
  };
  
  // Only fetch data when the dialog is actually open
  // Make sure to fetch when details tab is active if statistics are enabled
  const needsStatistics = activeTab === "details" && definition?.statistics;
  const { data: trendPoints, loading: trendLoading, error: trendError } = useTagTrend(
    definition?.name || '',
    hours, // Hours of data based on selected time range
    { 
      enabled: open && !!definition?.name && (activeTab === "trend" || needsStatistics), // Only fetch when needed
      retry: 1, // Only retry once
      refetchOnMount: true, // Refetch when component mounts to ensure data is available for both tabs
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
  const { minValue, maxValue, isVerySmallValue } = useMemo(() => {
    return calculateAxisBounds(validPoints, regressionLineData);
  }, [validPoints, regressionLineData]);
  
  // Format data for the chart
  const trendData = useMemo(() => formatTrendData(validPoints, smoothing), [validPoints, smoothing]);
  const formattedRegressionData = useMemo(() => formatTrendData(regressionLineData, false), [regressionLineData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          <div>
            <DialogTitle>
              {definition.desc}
            </DialogTitle>
            <p className="text-sm text-muted-foreground sm:hidden mt-1">
              {value?.timestamp ? new Date(value.timestamp).toLocaleTimeString() : 'No time data'}
              {definition.unit ? ` · ${definition.unit}` : ''}
            </p>
          </div>
          <button
            className="absolute top-0 right-0 sm:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="Back to dashboard"
          >
            <X size={18} />  
          </button>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">Текуща стойност</h3>
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
            
            <div className="bg-card p-4 rounded-lg border hidden sm:block">
              <h3 className="text-sm font-medium text-muted-foreground">Измервателна единица</h3>
              <div className="mt-2 text-2xl font-bold">
                {definition.unit}
              </div>
            </div>
            
            <div className="bg-card p-4 rounded-lg border hidden sm:block">
              <h3 className="text-sm font-medium text-muted-foreground">Последно обновение</h3>
              <div className="mt-2 text-xl font-bold">
                {value?.timestamp 
                  ? new Date(value.timestamp).toLocaleTimeString() 
                  : 'No data'}
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border p-4">
            <Tabs value={activeTab} onValueChange={(value) => {
              console.log('Tab changed to:', value);
              setActiveTab(value);
              // Force data load when switching to details tab if statistics are enabled
              if (value === 'details' && definition.statistics) {
                console.log('Loading data for statistics...');
                setIsChangingTimeRange(true);
                setTimeout(() => setIsChangingTimeRange(false), 200);
              }
            }}>
              <div className="flex justify-between items-center mb-4">
                <TabsList className="grid w-12rem grid-cols-2">
                  <TabsTrigger value="trend">Графика</TabsTrigger>
                  <TabsTrigger value="details">Статистики</TabsTrigger>
                </TabsList>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="flex items-center space-x-2 order-2 sm:order-1">
                    <Label htmlFor="smoothing" className="text-sm">филтър</Label>
                    <Switch 
                      id="smoothing" 
                      checked={smoothing} 
                      onCheckedChange={(checked: boolean) => {
                        setIsSmoothing(true);
                        setTimeout(() => {
                          setSmoothing(checked);
                          setIsSmoothing(false);
                        }, 300); // Brief delay to show loading state
                      }} 
                    />
                  </div>
                  
                  <div className="sm:ml-auto order-1 sm:order-2">
                    <TimeRangeSelector
                      selectedRange={selectedTimeRange}
                      onChange={handleTimeRangeChange}
                      className="scale-[0.85] origin-right"
                    />
                  </div>
                </div>
              </div>
              
              <TabsContent value="trend">
                <div className="h-[350px] sm:h-[400px]">
                  {/* Only render chart content when the trend tab is active */}
                  {activeTab === "trend" && (
                    (trendLoading || isChangingTimeRange || isSmoothing) ? (
                      <div className="h-full flex items-center justify-center">
                        <LoadingSpinner 
                          size={32} 
                          text={`Зареждане на данни за ${getTimeRangeLabel(selectedTimeRange)}...`} 
                        />
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
                            axisLine={{ stroke: '#ddd' }}
                            // Add markers for day boundaries
                            ticks={(() => {
                              // Get evenly distributed time ticks (show ~6 time points)
                              const dataLength = trendData.length;
                              const step = Math.max(1, Math.floor(dataLength / 6));
                              const timeTicks = [];
                              for (let i = 0; i < dataLength; i += step) {
                                timeTicks.push(trendData[i]?.time);
                              }
                              // Add the last point if not already included
                              if (dataLength > 0 && timeTicks[timeTicks.length - 1] !== trendData[dataLength - 1]?.time) {
                                timeTicks.push(trendData[dataLength - 1]?.time);
                              }
                              return timeTicks;
                            })()}
                          />
                          {/* Add a second XAxis for date markers */}
                          <XAxis 
                            dataKey="timestamp"
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => {
                              // Find points that represent the start of a day
                              const point = trendData.find(p => p.timestamp === value && p.isNewDay);
                              return point ? point.date : '';
                            }}
                            tick={{ fontSize: 10, fill: '#666' }}
                            xAxisId="date"
                            tickCount={trendData.filter(p => p.isNewDay).length}
                            // Only show ticks for day starting points
                            ticks={trendData.filter(p => p.isNewDay).map(p => p.timestamp)}
                          />
                          <YAxis 
                            width={50} // Slightly wider for small decimal values
                            domain={[Math.max(0, minValue), maxValue]} // Use our calculated min/max values but never go below 0
                            tick={{ fontSize: 10 }}
                            tickCount={5} // Control the number of ticks for better readability
                            tickFormatter={(value) => 
                              typeof value === 'number' 
                                ? formatYAxisTick(value, definition.precision, isVerySmallValue)
                                : value.toString()
                            }
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
                            labelFormatter={(label, payload) => {
                              // Find the data point using the time label to match
                              if (payload && payload.length > 0 && payload[0].payload) {
                                const dataPoint = payload[0].payload;
                                return dataPoint.fullDateTime ? 
                                  `Дата: ${dataPoint.fullDateTime}` : 
                                  `Време: ${label}`;
                              }
                              return `Време: ${label}`;
                            }}
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
                            dot={false} // No dots on the line
                            activeDot={{ r: 5, strokeWidth: 1 }} // Keep active dot for hover/interaction
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
                          {smoothing                     }
                        </LineChart>
                      </ResponsiveContainer>
                    )
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="details">
                <div className="space-y-4">
                  {/* Display statistics section if the tag has statistics property */}
                  {definition.statistics && (
                    <div className="mt-1">
                      <h4 className="text-sm font-medium mb-3 flex items-center">
                        <span className="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs mr-2">Статистически анализ</span>
                        Разпределение на данните
                      </h4>
                      {trendLoading || isChangingTimeRange ? (
                        <div className="h-[300px] flex items-center justify-center">
                          <LoadingSpinner 
                            size={24} 
                            text="Зареждане на статистически данни..." 
                          />
                        </div>
                      ) : !validPoints || validPoints.length === 0 ? (
                        <div className="h-[100px] flex items-center justify-center">
                          <p className="text-muted-foreground">Няма данни за статистически анализ</p>
                        </div>
                      ) : (
                        <StatisticsView 
                          trendData={validPoints}
                          definition={definition}
                          color={color}
                        />
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
