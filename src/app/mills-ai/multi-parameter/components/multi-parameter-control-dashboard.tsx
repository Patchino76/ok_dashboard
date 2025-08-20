"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProcessParameterCard } from "../../main-components/process-parameter-card"
import { FractionMainDisplay } from "./fraction-main-display"
import { Zap, Activity } from "lucide-react"

interface ProcessParameter {
  id: string
  name: string
  unit: string
  pv: number
  sp: number
  aiSp: number
  lowLimit: number
  highLimit: number
  trend: Array<{ timestamp: number; pv: number; sp: number }>
  color: string
  icon: string
}

interface FractionData {
  timestamp: number
  value: number
  target: number
}

export function MultiParameterControlDashboard() {
  const [parameters, setParameters] = useState<ProcessParameter[]>([
    {
      id: "ore",
      name: "Ore Feed Rate",
      unit: "t/h",
      pv: 125.5,
      sp: 130.0,
      aiSp: 130.0,
      lowLimit: 100,
      highLimit: 200,
      trend: [],
      color: "amber",
      icon: "⛏️",
    },
    {
      id: "water_mill",
      name: "Water Mill",
      unit: "m³/h",
      pv: 45.2,
      sp: 48.0,
      aiSp: 48.0,
      lowLimit: 30,
      highLimit: 70,
      trend: [],
      color: "blue",
      icon: "💧",
    },
    {
      id: "water_zumpf",
      name: "Water ZUMPF",
      unit: "m³/h",
      pv: 32.8,
      sp: 35.0,
      aiSp: 35.0,
      lowLimit: 20,
      highLimit: 50,
      trend: [],
      color: "cyan",
      icon: "🌊",
    },
    {
      id: "power",
      name: "Mill Power",
      unit: "kW",
      pv: 2850,
      sp: 2900,
      aiSp: 2900,
      lowLimit: 2000,
      highLimit: 3500,
      trend: [],
      color: "yellow",
      icon: "⚡",
    },
    {
      id: "density",
      name: "Pulp Density",
      unit: "kg/m³",
      pv: 1650,
      sp: 1680,
      aiSp: 1680,
      lowLimit: 1400,
      highLimit: 1900,
      trend: [],
      color: "purple",
      icon: "🧪",
    },
    {
      id: "pressure",
      name: "System Pressure",
      unit: "bar",
      pv: 2.45,
      sp: 2.5,
      aiSp: 2.5,
      lowLimit: 1.5,
      highLimit: 4.0,
      trend: [],
      color: "red",
      icon: "📊",
    },
    {
      id: "ph",
      name: "pH Level",
      unit: "pH",
      pv: 8.2,
      sp: 8.5,
      aiSp: 8.5,
      lowLimit: 7.0,
      highLimit: 10.0,
      trend: [],
      color: "green",
      icon: "🧬",
    },
    {
      id: "temperature",
      name: "Process Temp",
      unit: "°C",
      pv: 65.5,
      sp: 68.0,
      aiSp: 68.0,
      lowLimit: 50,
      highLimit: 85,
      trend: [],
      color: "orange",
      icon: "🌡️",
    },
  ])

  const [fractionData, setFractionData] = useState<FractionData[]>([])
  const [currentFraction, setCurrentFraction] = useState(78.5)
  const [targetFraction, setTargetFraction] = useState(82.0)

  // Simulate real-time process data
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      // Update parameters with AI optimization
      setParameters((prev) =>
        prev.map((param) => {
          // AI adjusts setpoint within bounds based on fraction error
          const fractionError = targetFraction - currentFraction
          const influence = Math.random() * 0.3 + 0.1 // Random influence factor
          const adjustment = fractionError * influence * (Math.random() - 0.5) * 0.1

          const newAiSp = Math.max(param.lowLimit, Math.min(param.highLimit, param.aiSp + adjustment))

          // PV follows SP with lag and noise
          const error = newAiSp - param.pv
          const newPV = param.pv + error * 0.15 + (Math.random() - 0.5) * (param.highLimit - param.lowLimit) * 0.02

          const newTrend = [...param.trend, { timestamp: now, pv: newPV, sp: newAiSp }].slice(-20) // Keep last 20 points

          return {
            ...param,
            pv: newPV,
            sp: newAiSp,
            aiSp: newAiSp,
            trend: newTrend,
          }
        }),
      )

      // Calculate fraction based on parameter influences
      const oreInfluence = ((parameters[0]?.pv || 125) / 130) * 20
      const waterInfluence = ((parameters[1]?.pv || 45) / 48) * 15
      const powerInfluence = ((parameters[3]?.pv || 2850) / 2900) * 25
      const densityInfluence = ((parameters[4]?.pv || 1650) / 1680) * 20

      const calculatedFraction =
        oreInfluence + waterInfluence + powerInfluence + densityInfluence + (Math.random() - 0.5) * 3
      setCurrentFraction(calculatedFraction)

      setFractionData((prev) =>
        [...prev, { timestamp: now, value: calculatedFraction, target: targetFraction }].slice(-50),
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [parameters, currentFraction, targetFraction])

  const overallError = Math.abs(targetFraction - currentFraction)
  const isSystemOptimal = overallError < 1.5

  return (
    <div className="space-y-6">
      {/* Main Fraction Display */}
      <FractionMainDisplay
        currentFraction={currentFraction}
        targetFraction={targetFraction}
        fractionData={fractionData}
        isOptimal={isSystemOptimal}
        onTargetChange={setTargetFraction}
        unit="%" // Mill recovery fraction is measured in percentage
      />

      {/* System Overview */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              System Overview
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant={isSystemOptimal ? "default" : "destructive"}>
                {isSystemOptimal ? "OPTIMAL" : "OPTIMIZING"}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                AI Active
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{parameters.length}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Active Parameters</div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {parameters.filter((p) => Math.abs(p.sp - p.pv) < (p.highLimit - p.lowLimit) * 0.05).length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">In Range</div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{overallError.toFixed(1)}%</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Fraction Error</div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className={`text-2xl font-bold ${isSystemOptimal ? "text-green-600" : "text-orange-600"}`}>
                {isSystemOptimal ? "STABLE" : "TUNING"}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parameter Control Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {parameters.map((parameter) => (
          <ProcessParameterCard
            key={parameter.id}
            parameter={parameter}
            onParameterUpdate={(updatedParam) => {
              setParameters((prev) => prev.map((p) => (p.id === updatedParam.id ? updatedParam : p)))
            }}
          />
        ))}
      </div>
    </div>
  )
}
