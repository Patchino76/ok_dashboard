"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { LineChart, Line, ResponsiveContainer } from "recharts"
import { ArrowUp, ArrowDown, Zap } from "lucide-react"

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

interface ProcessParameterCardProps {
  parameter: ProcessParameter
  onParameterUpdate: (parameter: ProcessParameter) => void
}

export function ProcessParameterCard({ parameter, onParameterUpdate }: ProcessParameterCardProps) {
  const [aiEnabled, setAiEnabled] = useState(true)
  const [spValue, setSpValue] = useState([parameter.sp])

  const error = parameter.sp - parameter.pv
  const errorPercentage = (Math.abs(error) / parameter.sp) * 100
  const isInRange = errorPercentage < 5

  const handleAiToggle = (enabled: boolean) => {
    setAiEnabled(enabled)

    if (!enabled) {
      // When switching to manual, initialize slider with current SP
      setSpValue([parameter.sp])
    } else {
      // When switching to AI, update to AI SP
      onParameterUpdate({
        ...parameter,
        sp: parameter.aiSp,
      })
    }
  }

  const handleSpChange = (value: number[]) => {
    setSpValue(value)

    if (!aiEnabled) {
      onParameterUpdate({
        ...parameter,
        sp: value[0],
      })
    }
  }

  // Determine color classes based on parameter.color
  const getBgColorClass = () => {
    switch (parameter.color) {
      case "blue": return "bg-blue-50 dark:bg-blue-900/20"
      case "green": return "bg-green-50 dark:bg-green-900/20"
      case "red": return "bg-red-50 dark:bg-red-900/20"
      case "amber": return "bg-amber-50 dark:bg-amber-900/20"
      case "yellow": return "bg-yellow-50 dark:bg-yellow-900/20"
      case "purple": return "bg-purple-50 dark:bg-purple-900/20"
      case "cyan": return "bg-cyan-50 dark:bg-cyan-900/20"
      case "orange": return "bg-orange-50 dark:bg-orange-900/20"
      default: return "bg-slate-50 dark:bg-slate-800/30"
    }
  }

  const getTextColorClass = () => {
    switch (parameter.color) {
      case "blue": return "text-blue-600"
      case "green": return "text-green-600"
      case "red": return "text-red-600"
      case "amber": return "text-amber-600"
      case "yellow": return "text-yellow-600"
      case "purple": return "text-purple-600"
      case "cyan": return "text-cyan-600"
      case "orange": return "text-orange-600"
      default: return "text-slate-600"
    }
  }

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
            {isInRange ? "In Range" : "Adjusting"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Values and Trend */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">Current (PV)</div>
            <div className="text-2xl font-bold flex items-center gap-1">
              {parameter.pv.toFixed(1)}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
              {error > 0 ? (
                <ArrowDown className="h-4 w-4 text-red-500" />
              ) : (
                <ArrowUp className="h-4 w-4 text-green-500" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">Target (SP)</div>
            <div className={`text-2xl font-bold ${getTextColorClass()}`}>
              {parameter.sp.toFixed(1)}
              <span className="text-xs text-slate-500 ml-1">{parameter.unit}</span>
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="h-14 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={parameter.trend}>
              <Line
                type="monotone"
                dataKey="pv"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="sp"
                stroke="#10b981"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 3"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Control Toggle */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <Zap className={`h-4 w-4 ${aiEnabled ? "text-purple-500" : "text-slate-400"}`} />
            <Label htmlFor={`ai-control-${parameter.id}`} className="text-sm cursor-pointer">
              AI Control
            </Label>
          </div>
          <Switch
            id={`ai-control-${parameter.id}`}
            checked={aiEnabled}
            onCheckedChange={handleAiToggle}
            aria-label="Toggle AI control"
          />
        </div>

        {/* Slider Control */}
        {!aiEnabled && (
          <div className="pt-2">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{parameter.lowLimit}</span>
              <span>{parameter.highLimit}</span>
            </div>
            <Slider
              value={spValue}
              onValueChange={handleSpChange}
              min={parameter.lowLimit}
              max={parameter.highLimit}
              step={(parameter.highLimit - parameter.lowLimit) / 100}
              className="mt-1"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
