"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LineChart, Line, ResponsiveContainer } from "recharts"

interface Parameter {
  id: string
  name: string
  unit: string
  value: number
  trend: Array<{ timestamp: number; value: number }>
  color: string
  icon: string
}

interface ParameterSimulationCardProps {
  parameter: Parameter
  bounds: [number, number]
  onParameterUpdate: (id: string, value: number) => void
}

export function ParameterSimulationCard({ parameter, bounds, onParameterUpdate }: ParameterSimulationCardProps) {
  const [sliderValue, setSliderValue] = useState([parameter.value])
  const [inputValue, setInputValue] = useState(parameter.value.toString())
  
  const isInRange = parameter.value >= bounds[0] && parameter.value <= bounds[1]
  
  // Handle slider change
  const handleSliderChange = (value: number[]) => {
    const newValue = value[0]
    setSliderValue(value)
    setInputValue(newValue.toFixed(2))
    onParameterUpdate(parameter.id, newValue)
  }
  
  // Handle direct input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }
  
  // Handle input blur (to update when user finishes typing)
  const handleInputBlur = () => {
    const newValue = parseFloat(inputValue)
    if (!isNaN(newValue)) {
      // Clamp value within bounds
      const clampedValue = Math.max(bounds[0], Math.min(bounds[1], newValue))
      setSliderValue([clampedValue])
      setInputValue(clampedValue.toFixed(2))
      onParameterUpdate(parameter.id, clampedValue)
    } else {
      // Restore previous value if invalid input
      setInputValue(parameter.value.toFixed(2))
    }
  }
  
  // Handle key press (Enter) to confirm input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur()
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
            {isInRange ? "In Range" : "Out of Range"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Values and Trend */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">Current Value</div>
            <div className="text-2xl font-bold flex items-center gap-1">
              {parameter.value.toFixed(2)}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">Range</div>
            <div className="text-sm">
              {bounds[0].toFixed(2)} - {bounds[1].toFixed(2)} 
              <span className="text-xs text-slate-500 ml-1">{parameter.unit}</span>
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        {parameter.trend.length > 0 && (
          <div className="h-14 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={parameter.trend}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Slider and Input Control */}
        <div className="pt-2 space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-500">{bounds[0].toFixed(2)}</div>
            <div className="w-24">
              <Input
                type="number"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyPress={handleKeyPress}
                step={0.01}
                min={bounds[0]}
                max={bounds[1]}
                className="h-8 text-center"
              />
            </div>
            <div className="text-xs text-slate-500">{bounds[1].toFixed(2)}</div>
          </div>
          <Slider
            value={sliderValue}
            onValueChange={handleSliderChange}
            min={bounds[0]}
            max={bounds[1]}
            step={(bounds[1] - bounds[0]) / 100}
            className="mt-1"
          />
        </div>
      </CardContent>
    </Card>
  )
}
