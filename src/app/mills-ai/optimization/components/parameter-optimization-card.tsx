"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { millsParameters } from "../../data/mills-parameters"
import { useXgboostStore } from "../../stores/xgboost-store"
import { DoubleRangeSlider } from "../../components/double-range-slider"

interface Parameter {
  id: string
  name: string
  unit: string
  value: number
  trend: Array<{ timestamp: number; value: number }>
  color: string
  icon: string
  isLab?: boolean
}

interface ParameterOptimizationCardProps {
  parameter: Parameter
  bounds: [number, number]
  rangeValue: [number, number]
  isSimulationMode?: boolean
  onRangeChange: (id: string, range: [number, number]) => void
}

export function ParameterOptimizationCard({ 
  parameter, 
  bounds,
  rangeValue,
  isSimulationMode = true,
  onRangeChange 
}: ParameterOptimizationCardProps) {
  // Get displayHours from the store to filter trend data
  const displayHours = useXgboostStore(state => state.displayHours);
  // Check if this is a lab parameter
  const parameterConfig = millsParameters.find(p => p.id === parameter.id);
  const isLabParameter = parameterConfig?.isLab || false;
  
  // Local state for range values
  const [range, setRange] = useState<[number, number]>(rangeValue);
  
  // Update local state when prop changes
  useEffect(() => {
    setRange(rangeValue);
  }, [rangeValue]);

  const isInRange = parameter.value >= range[0] && parameter.value <= range[1];
  
  // Handle range change from DoubleRangeSlider
  const handleRangeChange = (newRange: [number, number]) => {
    // Always reflect local UI state
    setRange(newRange);
    // Only propagate changes when interaction is allowed
    if (isSimulationMode) {
      onRangeChange(parameter.id, newRange);
    }
  };
  
  // Format time for tooltip
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
    const formattedTime = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    return `${formattedDate} ${formattedTime}`;
  };
  
  // Format value for tooltip
  const formatValue = (value: number) => {
    return value.toFixed(1);
  };

  // Calculate optimal y-axis domain based on data values and bounds
  const calculateYAxisDomain = (trend: Array<{ timestamp: number; value: number }>, bounds: [number, number]) => {
    if (trend.length === 0) return bounds;
    
    // Get min and max values from trend data
    const values = trend.map(point => point.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    
    // Add padding (10% of data range)
    const dataRange = dataMax - dataMin;
    const padding = Math.max(dataRange * 0.1, 0.01);
    
    // Calculate new min/max with padding, but respect bounds
    let yMin = Math.max(dataMin - padding, bounds[0]);
    let yMax = Math.min(dataMax + padding, bounds[1]);
    
    // If the range is too small, center it and expand
    if (yMax - yMin < dataRange * 1.3) {
      const center = (yMin + yMax) / 2;
      const halfRange = dataRange * 0.65;
      yMin = Math.max(center - halfRange, bounds[0]);
      yMax = Math.min(center + halfRange, bounds[1]);
    }
    
    return [yMin, yMax];
  };
  
  // Determine color classes based on parameter.color
  const getBgColorClass = () => {
    switch (parameter.color) {
      case "blue": return "bg-blue-50 dark:bg-blue-900/20";
      case "green": return "bg-green-50 dark:bg-green-900/20";
      case "red": return "bg-red-50 dark:bg-red-900/20";
      case "amber": return "bg-amber-50 dark:bg-amber-900/20";
      case "yellow": return "bg-yellow-50 dark:bg-yellow-900/20";
      case "purple": return "bg-purple-50 dark:bg-purple-900/20";
      case "cyan": return "bg-cyan-50 dark:bg-cyan-900/20";
      case "orange": return "bg-orange-50 dark:bg-orange-900/20";
      default: return "bg-slate-50 dark:bg-slate-800/30";
    }
  };

  const getTextColorClass = () => {
    switch (parameter.color) {
      case "blue": return "text-blue-600";
      case "green": return "text-green-600";
      case "red": return "text-red-600";
      case "amber": return "text-amber-600";
      case "yellow": return "text-yellow-600";
      case "purple": return "text-purple-600";
      case "cyan": return "text-cyan-600";
      case "orange": return "text-orange-600";
      default: return "text-slate-600";
    }
  };
  
  // Get stroke color for trend line based on parameter.color
  const getStrokeColor = () => {
    switch (parameter.color) {
      case "blue": return "#2563eb";    // blue-600
      case "green": return "#16a34a";  // green-600
      case "red": return "#dc2626";    // red-600
      case "amber": return "#d97706";  // amber-600
      case "yellow": return "#ca8a04"; // yellow-600
      case "purple": return "#9333ea"; // purple-600
      case "cyan": return "#0891b2";   // cyan-600
      case "orange": return "#ea580c"; // orange-600
      default: return "#475569";       // slate-600
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 ${getBgColorClass()}`} />

      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <span className="text-xl">{parameter.icon}</span>
            {parameter.name}
          </CardTitle>
          <Badge variant={isInRange ? "outline" : "secondary"} className={isInRange ? getTextColorClass() : ""}>
            {isInRange ? "In Range" : "Out of Range"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Values and Range */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {isLabParameter ? 'Lab Value' : 'Current Value'}
            </div>
            <div className="text-2xl font-bold flex items-center gap-1">
              {parameter.value.toFixed(2)}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">Optimization Range</div>
            <div className="text-sm">
              {range[0].toFixed(2)} - {range[1].toFixed(2)}
              <span className="text-xs text-slate-500 ml-1">{parameter.unit}</span>
            </div>
          </div>
        </div>

        {/* Trend Chart - Only show for process parameters */}
        {!isLabParameter && parameter.trend.length > 0 && (() => {
          // Filter trend data based on current displayHours
          const hoursAgo = Date.now() - displayHours * 60 * 60 * 1000;
          const filteredTrend = parameter.trend.filter(item => item.timestamp >= hoursAgo);
          
          return (
            <div className="h-24 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredTrend} margin={{ top: 5, right: 10, bottom: 5, left: 40 }}>
                  <XAxis dataKey="timestamp" hide={true} />
                  <YAxis 
                    domain={[bounds[0], bounds[1]]}
                    hide={false}
                    width={40}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value.toFixed(2)}
                    ticks={[bounds[0], bounds[1]]}
                    interval={0}
                    allowDataOverflow={false}
                    axisLine={true}
                    tickLine={true}
                    tickMargin={3}
                    orientation="left"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatValue(value), parameter.name]}
                    labelFormatter={(timestamp: number) => formatTime(timestamp)}
                    contentStyle={{ background: "#1f2937", borderColor: "#374151", color: "#e5e7eb", fontSize: "12px" }}
                    itemStyle={{ color: "#e5e7eb" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={getStrokeColor()}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
        
        {/* Lab parameter info */}
        {isLabParameter && (
          <div className="h-14 -mx-2 flex items-center justify-center">
            <div className="text-sm text-slate-500 dark:text-slate-400 text-center">
              🧪 Lab Parameter<br/>
              <span className="text-xs">No historical trending</span>
            </div>
          </div>
        )}

        {/* Double Range Slider (full width, no duplicate labels) */}
        <div className="pt-2">
          <div className={`${!isSimulationMode ? 'opacity-50 pointer-events-none' : ''}`}>
            <DoubleRangeSlider
              min={bounds[0]}
              max={bounds[1]}
              value={range}
              onChange={handleRangeChange}
              step={(bounds[1] - bounds[0]) / 100}
              className={'w-full'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
