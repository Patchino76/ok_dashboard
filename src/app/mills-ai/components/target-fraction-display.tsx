"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { CheckCircle, AlertTriangle, Target, TrendingUp } from "lucide-react"
import { useXgboostStore } from "../stores/xgboost-store"

interface TargetData {
  timestamp: number
  value: number
  target: number
  pv: number
  sp?: number | null
}

interface TargetFractionDisplayProps {
  currentTarget: number | null
  currentPV: number | null
  targetData: TargetData[]
  isOptimizing: boolean
  isSimulationMode?: boolean
  modelName?: string
  targetVariable?: string
  targetUnit?: string
  spOptimize?: number | null
  showOptimizationTarget?: boolean
}

export function TargetFractionDisplay({
  currentTarget,
  currentPV,
  targetData,
  isOptimizing,
  isSimulationMode = false,
  targetVariable,
  targetUnit = "%", // Default to % if no unit is provided
  spOptimize = null,
  showOptimizationTarget = false,
  // modelName is intentionally not destructured to avoid unused vars
}: TargetFractionDisplayProps) {
  
  // Get display hours and data fetching functions from store
  const displayHours = useXgboostStore(state => state.displayHours)
  const setDisplayHours = useXgboostStore(state => state.setDisplayHours)
  const fetchRealTimeData = useXgboostStore(state => state.fetchRealTimeData)
  
  // Note: Immediate refresh is now handled in the store's setDisplayHours function
  // This ensures API calls happen immediately when time delta buttons are clicked

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
  }

  const formatTooltipValue = (value: number) => {
    return value?.toFixed(2) || 'N/A'
  }

  // Format data for chart - show only last selected hours of data
  const hoursAgo = Date.now() - displayHours * 60 * 60 * 1000; // adjustable window
  
  const chartData = targetData
    .filter(item => item.timestamp >= hoursAgo) // Only keep data from the selected window
    .map((item) => ({
      time: item.timestamp,
      value: item.value,
      target: item.target,
      pv: item.pv,
      // For the first data point, ensure SP overlaps with PV if SP is not set
      sp: item.sp !== undefined ? item.sp : (targetData.length === 1 ? item.pv : null)
    }))
    .sort((a, b) => a.time - b.time); // Ensure data is sorted by time

  // Robust, dynamic gauge bounds with hysteresis
  // Do not clamp to 0–100; allow the scale to expand beyond if data requires it
  const domainMin = -Infinity;
  const domainMax = Infinity;
  const minSpanAbs = 2; // enforce at least 2 percentage points of span
  const changeThreshold = 0.25; // >25% change in range triggers rescale
  const edgeMarginFrac = 0.1; // if values are within 10% of edges, expand

  const windowValues = useMemo(() => {
    // Use retained historical data (store already prunes to retention window)
    const vals: number[] = [];
    for (const d of targetData) {
      if (typeof d.pv === 'number' && isFinite(d.pv)) vals.push(d.pv);
      if (typeof d.sp === 'number' && isFinite(d.sp as number)) vals.push(d.sp as number);
    }
    if (typeof currentPV === 'number' && isFinite(currentPV)) vals.push(currentPV);
    if (typeof currentTarget === 'number' && isFinite(currentTarget)) vals.push(currentTarget);
    return vals;
  }, [targetData, currentPV, currentTarget]);

  const quantile = (sorted: number[], q: number) => {
    if (!sorted.length) return NaN;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
      return sorted[base];
    }
  };

  const boundsRef = useRef<{ min: number; max: number }>({ min: 0, max: 100 });
  const [scaleMin, setScaleMin] = useState<number>(0);
  const [scaleMax, setScaleMax] = useState<number>(100);

  useEffect(() => {
    const vals = windowValues.slice().sort((a, b) => a - b);
    let baselineMin = vals.length ? quantile(vals, 0.05) : domainMin;
    let baselineMax = vals.length ? quantile(vals, 0.95) : domainMax;

    // Ensure current values are included in the range
    if (typeof currentPV === 'number') {
      baselineMin = Math.min(baselineMin, currentPV);
      baselineMax = Math.max(baselineMax, currentPV);
    }
    if (typeof currentTarget === 'number') {
      baselineMin = Math.min(baselineMin, currentTarget);
      baselineMax = Math.max(baselineMax, currentTarget);
    }
    if (typeof spOptimize === 'number' && showOptimizationTarget) {
      baselineMin = Math.min(baselineMin, spOptimize);
      baselineMax = Math.max(baselineMax, spOptimize);
    }

    const range = Math.max(baselineMax - baselineMin, 0.001);
    const pad = Math.max(0.5, range * 0.1);
    let proposedMin = baselineMin - pad;
    let proposedMax = baselineMax + pad;

    // Enforce a minimum span
    if (proposedMax - proposedMin < minSpanAbs) {
      const center = (baselineMin + baselineMax) / 2;
      proposedMin = center - minSpanAbs / 2;
      proposedMax = center + minSpanAbs / 2;
    }

    // Hysteresis: only update if necessary
    const curr = boundsRef.current;
    const currRange = Math.max(curr.max - curr.min, 0.001);
    const propRange = Math.max(proposedMax - proposedMin, 0.001);
    const valuesToCheck = [currentPV, currentTarget];
    if (typeof spOptimize === 'number' && showOptimizationTarget) {
      valuesToCheck.push(spOptimize);
    }
    const outOfRange = valuesToCheck.some(
      (v) => typeof v === 'number' && (v < curr.min || v > curr.max)
    );
    const nearEdge = valuesToCheck.some(
      (v) => typeof v === 'number' && (v - curr.min < currRange * edgeMarginFrac || curr.max - v < currRange * edgeMarginFrac)
    );
    const rangeChanged = propRange > currRange * (1 + changeThreshold) || propRange < currRange * (1 - changeThreshold);

    if (outOfRange || nearEdge || rangeChanged || (curr.min === domainMin && curr.max === domainMax)) {
      boundsRef.current = { min: proposedMin, max: proposedMax };
      setScaleMin(proposedMin);
      setScaleMax(proposedMax);
    }
  }, [windowValues, currentPV, currentTarget, spOptimize, showOptimizationTarget, displayHours]);

  const formatValue = (v?: number | null) => {
    if (v === undefined || v === null) return "--"
    return `${v.toFixed(1)}${targetUnit}`
  }

  const toPercent = (v?: number | null) => {
    if (typeof v !== 'number') return 0;
    if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax) || scaleMax <= scaleMin) return 0;
    const pct = ((v - scaleMin) / (scaleMax - scaleMin)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const pvPercent = toPercent(currentPV);
  const spPercent = toPercent(currentTarget);

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Mill Recovery Fraction
            {targetVariable && <span className="text-sm font-normal ml-2">({targetVariable})</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={!isOptimizing ? "default" : "destructive"} className="px-3 py-1">
              {!isOptimizing ? "READY" : "PREDICTING"}
            </Badge>
            {!isOptimizing ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Main Values Display */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <div className="space-y-6">
              {/* Current Values */}
              <div className="space-y-4">
                {/* Process Variable (PV) */}
                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Process Variable (PV)</div>
                  <div className="mt-1 flex items-end">
                    <span className="text-4xl font-bold text-emerald-600">{currentPV?.toFixed(1) || 'N/A'}</span>
                    <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">{targetUnit}</span>
                  </div>
                  {/* PV horizontal gauge */}
                  <div className="mt-2">
                    <div className="relative h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-emerald-500"
                        style={{ width: `${pvPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{Number.isFinite(scaleMin) ? scaleMin.toFixed(1) : '—'}{targetUnit}</span>
                      <span>{Number.isFinite(scaleMax) ? scaleMax.toFixed(1) : '—'}{targetUnit}</span>
                    </div>
                  </div>
                </div>

                {/* Current Target/Setpoint (SP) */}
                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Setpoint Target (SP)</div>
                  <div className="mt-1 flex items-end">
                    <span className={`text-4xl font-bold ${isSimulationMode ? 'text-red-600' : 'text-blue-600'}`}>
                      {currentTarget?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">{targetUnit}</span>
                  </div>
                  {/* SP horizontal gauge */}
                  <div className="mt-2">
                    <div className="relative h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full ${isSimulationMode ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${spPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{Number.isFinite(scaleMin) ? scaleMin.toFixed(1) : '—'}{targetUnit}</span>
                      <span>{Number.isFinite(scaleMax) ? scaleMax.toFixed(1) : '—'}{targetUnit}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Removed model and target variable section for a cleaner comparison layout */}
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">PSI80 Trend</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Process Variable (PV)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${isSimulationMode ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                    <span>Setpoint (SP) {isSimulationMode ? '(Simulation)' : '(Real-time)'}</span>
                  </div>
                  {showOptimizationTarget && (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-1 bg-orange-500"></div>
                      <span>Optimization Target</span>
                    </div>
                  )}
                  {/* Time range selector */}
                  <div className="hidden sm:flex items-center gap-1 ml-4">
                    <span className="text-slate-500 mr-1">Last:</span>
                    <Button
                      size="sm"
                      variant={displayHours === 4 ? "default" : "outline"}
                      className="px-2"
                      onClick={() => setDisplayHours(4)}
                    >
                      4h
                    </Button>
                    <Button
                      size="sm"
                      variant={displayHours === 8 ? "default" : "outline"}
                      className="px-2"
                      onClick={() => setDisplayHours(8)}
                    >
                      8h
                    </Button>
                    <Button
                      size="sm"
                      variant={displayHours === 24 ? "default" : "outline"}
                      className="px-2"
                      onClick={() => setDisplayHours(24)}
                    >
                      24h
                    </Button>
                    <Button
                      size="sm"
                      variant={displayHours === 72 ? "default" : "outline"}
                      className="px-2"
                      onClick={() => setDisplayHours(72)}
                    >
                      72h
                    </Button>
                  </div>
                </div>
              </div>

              <div className="h-[240px]" >
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis
                        dataKey="time"
                        tickFormatter={formatTime}
                        stroke="#6b7280"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#6b7280"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        domain={[
                          (dataMin: number) => Math.floor(dataMin - 2),
                          (dataMax: number) => Math.ceil(dataMax + 2),
                        ]}
                        tickFormatter={(value) => value.toString()}
                        width={60}
                        label={{ 
                          value: targetUnit, 
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#4b5563',
                          style: { 
                            fontSize: '12px',
                            fontWeight: '500',
                            textAnchor: 'middle',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid #e5e7eb'
                          },
                          offset: 10
                        }}
                      />
                      <Tooltip
                        labelFormatter={(value) => `Време: ${formatTime(value)}`}
                        formatter={(value: number, name: string, props: any) => {
                          const isPV = name === 'Process Variable (PV)';
                          const displayValue = isPV ? props.payload.pv : value;
                          const color = isPV ? '#10b981' : (isSimulationMode ? '#dc2626' : '#3b82f6');
                          return [
                            <span key="value" style={{ color }}>{`${isPV ? 'PV' : 'SP'}: ${formatTooltipValue(displayValue)}${targetUnit}`}</span>,
                            <span key="name" style={{ color, opacity: 0.7, fontSize: '0.9em' }}>(${targetVariable || 'PSI80'})</span>
                          ];
                        }}
                        contentStyle={{
                          background: '#1f2937',
                          borderColor: '#374151',
                          borderRadius: '0.375rem',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}
                        itemStyle={{ 
                          color: '#e5e7eb',
                          padding: '0.25rem 0',
                          textTransform: 'none',
                          letterSpacing: '0.025em'
                        }}
                        labelStyle={{
                          color: '#e5e7eb',
                          fontWeight: 500,
                          marginBottom: '0.5rem',
                          borderBottom: '1px solid #374151',
                          paddingBottom: '0.5rem'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="pv" 
                        name="Process Variable (PV)" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false} // Disable animation to ensure line is always visible
                      />
                      <Line 
                        type="monotone" 
                        dataKey="sp" 
                        name={isSimulationMode ? 'Setpoint (SP) (Simulation)' : 'Setpoint (SP) (Real-time)'} 
                        stroke={isSimulationMode ? "#dc2626" : "#3b82f6"} 
                        strokeWidth={2} 
                        strokeDasharray="5 5" 
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false} // Disable animation to ensure line is always visible
                      />
                      {/* Optimization Target Horizontal Line */}
                      {showOptimizationTarget && typeof spOptimize === 'number' && (
                        <Line 
                          type="monotone" 
                          dataKey={() => spOptimize}
                          name="Optimization Target"
                          stroke="#f97316" 
                          strokeWidth={3}
                          strokeDasharray="10 5"
                          dot={false}
                          isAnimationActive={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-slate-500">No prediction data available. Adjust parameters and click Predict.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
