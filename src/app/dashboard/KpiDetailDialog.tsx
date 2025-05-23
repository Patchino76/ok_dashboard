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
import { useTagTrend } from "@/hooks"
import { X } from "lucide-react"
import { TimeRangeSelector, TimeRange } from "./components/TimeRangeSelector"
import { getHoursFromTimeRange, getTimeRangeLabel } from "@/lib/utils/kpi/timeUtils"
import { LoadingSpinner } from "./components/LoadingSpinner"
import { StatisticsView } from "./components/StatisticsView"
import { TrendChart } from "@/components/charts/trend/TrendChart"

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
  // Default to trend tab, especially if statistics aren't available
  const [activeTab, setActiveTab] = useState("trend");
  
  // Reset to trend tab if we switch to a tag without statistics
  React.useEffect(() => {
    if (!definition?.statistics && activeTab === "details") {
      setActiveTab("trend");
    }
  }, [definition, activeTab]);
  
  // We'll use this to track if we're on the details tab separately
  // This helps ensure UI elements are properly hidden/shown
  const isDetailsTab = activeTab === "details";
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
  
  // We'll directly use the validPoints in the TrendChart component

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
                  <TabsTrigger value="trend">Тренд</TabsTrigger>
                  <TabsTrigger 
                    value="details" 
                    disabled={!definition.statistics}
                    className={!definition.statistics ? "cursor-not-allowed opacity-50" : ""}
                  >
                    Стат.
                  </TabsTrigger>
                </TabsList>
                
                {/* Keep smoothing switch on the same row with tabs */}
                {activeTab === "trend" && (
                  <div className="flex items-center">
                    <Label htmlFor="smoothing" className="text-sm mr-2">филтър</Label>
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
                )}
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
                        <p className="text-red-500">Грешка при зареждане на данните</p>
                      </div>
                    ) : validPoints.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-muted-foreground">Няма данни за избрания период</p>
                      </div>
                    ) : (
                      <TrendChart 
                        data={validPoints}
                        color={color}
                        height="100%"
                        smoothing={smoothing}
                        showRegression={true}
                        unit={definition?.unit}
                        precision={definition?.precision}
                      />
                    )
                  )}
                </div>
                
                {/* Time range selector below chart */}
                <div className="flex justify-center mt-4">
                  <TimeRangeSelector
                    selectedRange={selectedTimeRange}
                    onChange={handleTimeRangeChange}
                  />
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
                      
                      {/* Time range selector below statistics */}
                      <div className="flex justify-center mt-6">
                        <TimeRangeSelector
                          selectedRange={selectedTimeRange}
                          onChange={handleTimeRangeChange}
                        />
                      </div>
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
