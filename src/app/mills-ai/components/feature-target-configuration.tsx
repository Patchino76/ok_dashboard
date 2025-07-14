"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Target, Zap, X } from "lucide-react"
import type { ModelParameter } from "./model-training-dashboard"

interface FeatureTargetConfigurationProps {
  parameters: ModelParameter[]
  onParameterUpdate: (parameter: ModelParameter) => void
}

export function FeatureTargetConfiguration({ parameters, onParameterUpdate }: FeatureTargetConfigurationProps) {
  const handleTypeChange = (parameter: ModelParameter, newType: "feature" | "target") => {
    onParameterUpdate({
      ...parameter,
      type: newType,
    })
  }

  const handleEnabledChange = (parameter: ModelParameter, enabled: boolean) => {
    onParameterUpdate({
      ...parameter,
      enabled,
    })
  }

  const handleBoundsChange = (parameter: ModelParameter, type: "min" | "max", value: number[]) => {
    onParameterUpdate({
      ...parameter,
      [type === "min" ? "currentMin" : "currentMax"]: value[0],
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "feature":
        return <Zap className="h-4 w-4 text-blue-600" />
      case "target":
        return <Target className="h-4 w-4 text-green-600" />
      default:
        return <Zap className="h-4 w-4 text-slate-400" />
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "feature":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Feature
          </Badge>
        )
      case "target":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Target
          </Badge>
        )
      default:
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Feature
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-4">
      {parameters.map((parameter, index) => (
        <Card key={parameter.id} className="border border-slate-200 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Parameter Info */}
              <div className="lg:col-span-3">
                <div className="flex items-center gap-2 mb-1">
                  {getTypeIcon(parameter.type)}
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{parameter.name}</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{parameter.description}</p>
                {getTypeBadge(parameter.type)}
              </div>

              {/* Type Selection */}
              <div className="lg:col-span-2">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Type</Label>
                <Select value={parameter.type} onValueChange={(value) => handleTypeChange(parameter, value as any)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="target">Target</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Enable/Disable */}
              <div className="lg:col-span-1 flex justify-center">
                <div className="flex flex-col items-center gap-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Active</Label>
                  <Switch
                    checked={parameter.enabled}
                    onCheckedChange={(enabled) => handleEnabledChange(parameter, enabled)}
                  />
                </div>
              </div>

              {/* Bounds Configuration */}
              <div className="lg:col-span-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Min: {parameter.currentMin} {parameter.unit}
                    </Label>
                    <Slider
                      value={[parameter.currentMin]}
                      onValueChange={(value) => handleBoundsChange(parameter, "min", value)}
                      min={parameter.min}
                      max={parameter.currentMax - (parameter.max - parameter.min) * 0.1}
                      step={(parameter.max - parameter.min) / 100}
                      className="mt-1"
                      disabled={!parameter.enabled}
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>{parameter.min}</span>
                      <span>{parameter.currentMax}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Max: {parameter.currentMax} {parameter.unit}
                    </Label>
                    <Slider
                      value={[parameter.currentMax]}
                      onValueChange={(value) => handleBoundsChange(parameter, "max", value)}
                      min={parameter.currentMin + (parameter.max - parameter.min) * 0.1}
                      max={parameter.max}
                      step={(parameter.max - parameter.min) / 100}
                      className="mt-1"
                      disabled={!parameter.enabled}
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>{parameter.currentMin}</span>
                      <span>{parameter.max}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
