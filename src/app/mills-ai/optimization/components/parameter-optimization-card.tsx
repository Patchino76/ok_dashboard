"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceArea, ReferenceLine } from "recharts"
import { millsParameters } from "../../data/mills-parameters"
import { useXgboostStore } from "../../stores/xgboost-store"
import { DoubleRangeSlider } from "../../components/double-range-slider"
import { useOptimizationStore } from '@/app/mills-ai/stores/optimization-store'

interface Parameter {
  id: string
  name: string
  unit: string
  value: number
  trend: Array<{ timestamp: number; value: number }>
  color: string
  icon: string
  varType: "MV" | "CV" | "DV" // Variable type instead of isLab
}

interface ParameterOptimizationCardProps {
  parameter: Parameter
  bounds: [number, number]
  rangeValue: [number, number]
  isSimulationMode?: boolean
  proposedSetpoint?: number
  onRangeChange: (id: string, range: [number, number]) => void
}

export function ParameterOptimizationCard({ 
  parameter, 
  bounds,
  rangeValue,
  isSimulationMode = true,
  proposedSetpoint,
  onRangeChange 
}: ParameterOptimizationCardProps) {
  // Get displayHours from the store to filter trend data
  const displayHours = useXgboostStore(state => state.displayHours);
  // Check if this is a lab parameter (DV = Disturbance Variable)
  const isLabParameter = parameter.varType === 'DV';
  
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

  // Simple domain calculation - let Recharts handle most of the work
  const calculateYAxisDomain = (trend: Array<{ timestamp: number; value: number }>) => {
    if (trend.length === 0) return ['dataMin - 5', 'dataMax + 5'];
    
    // Use Recharts' auto-scaling with padding
    return ['dataMin - 5%', 'dataMax + 5%'];
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

  // Background styles based on varType to match the provided examples
  const getVarTypeStyles = () => {
    switch (parameter.varType) {
      // CV: cool blue background
      case "CV":
        return {
          cardBg:
            "bg-gradient-to-br from-white to-blue-100/80 dark:from-slate-800 dark:to-blue-900/40",
          topBar: "from-blue-500 to-cyan-500",
          ring: "ring-1 ring-blue-200/70 dark:ring-blue-900/50",
        };
      // MV: warm orange background
      case "MV":
        return {
          cardBg:
            "bg-gradient-to-br from-white to-amber-100/80 dark:from-slate-800 dark:to-amber-900/40",
          topBar: "from-amber-500 to-orange-500",
          ring: "ring-1 ring-amber-200/70 dark:ring-amber-900/50",
        };
      // DV: soft green background
      case "DV":
      default:
        return {
          cardBg:
            "bg-gradient-to-br from-white to-green-100/80 dark:from-slate-800 dark:to-green-900/40",
          topBar: "from-green-500 to-emerald-500",
          ring: "ring-1 ring-green-200/70 dark:ring-green-900/50",
        };
    }
  };

  const vt = getVarTypeStyles();

  return (
    <Card className={`shadow-lg border-0 ${vt.cardBg} ${vt.ring ?? ''} backdrop-blur-sm overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${vt.topBar}`} />

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

        {/* Trend Chart - Show for process parameters even if no trend points to keep SP/shading visible */}
        {!isLabParameter && (() => {
          // Filter trend data based on current displayHours
          const hoursAgo = Date.now() - displayHours * 60 * 60 * 1000;
          const filteredTrend = parameter.trend.filter(item => item.timestamp >= hoursAgo);
          
          // Calculate Y-axis domain to include data, optimization bounds, and proposed setpoint
          let yMin: number
          let yMax: number
          
          if (filteredTrend.length > 0) {
            const values = filteredTrend.map(d => d.value)
            yMin = Math.min(...values, range[0], typeof proposedSetpoint === 'number' ? proposedSetpoint : values[0])
            yMax = Math.max(...values, range[1], typeof proposedSetpoint === 'number' ? proposedSetpoint : values[0])
          } else {
            // Fallback when no trend points in window - ensure bounds and proposed setpoint are visible
            const base = typeof proposedSetpoint === 'number' ? proposedSetpoint : (range[0] + range[1]) / 2
            yMin = Math.min(range[0], base)
            yMax = Math.max(range[1], base)
          }
          
          const pad = (yMax - yMin) || 1
          const yAxisDomain: [number, number] = [yMin - pad * 0.05, yMax + pad * 0.05]
          
          // Debug logging
          console.log(`Parameter ${parameter.id}: Filtering trend data with ${displayHours}h window`);
          console.log(`- Original trend points: ${parameter.trend.length}`);
          console.log(`- Filtered trend points: ${filteredTrend.length}`);
          console.log(`- Y-axis domain: [${yAxisDomain[0]}, ${yAxisDomain[1]}]`);
          
          return (
            <div className="h-24 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredTrend} margin={{ top: 5, right: 10, bottom: 5, left: 40 }}>
                  <XAxis dataKey="timestamp" hide={true} />
                  <YAxis 
                    domain={yAxisDomain}
                    hide={false}
                    width={40}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value >= 1 ? value.toFixed(0) : value.toFixed(2)}
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
                  {/* Proposed Setpoint horizontal dashed line (only shown after optimization) */}
                  {typeof proposedSetpoint === 'number' && (
                    <ReferenceLine
                      y={proposedSetpoint}
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      ifOverflow="extendDomain"
                    />
                  )}
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
          <DoubleRangeSlider
            min={bounds[0]}
            max={bounds[1]}
            value={range}
            onChange={handleRangeChange}
            step={(bounds[1] - bounds[0]) / 100}
            className={'w-full'}
          />
          {/* Proposed Setpoint Indicator (only shown after optimization) */}
          {typeof proposedSetpoint === 'number' && (
            <div className="mt-2 text-sm text-orange-400 font-extrabold flex items-center gap-2">
              <div className="w-4 h-2 bg-orange-400 rounded"></div>
              <span className="text-orange-400">Предложение: {proposedSetpoint.toFixed(2)} {parameter.unit}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
