"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { SimulationParameter } from "../stores/cascade-simulation-store"

interface VerticalParameterSliderProps {
  parameter: SimulationParameter
  onValueChange: (id: string, value: number) => void
  disabled?: boolean
  showInput?: boolean
}

export function VerticalParameterSlider({
  parameter,
  onValueChange,
  disabled = false,
  showInput = true
}: VerticalParameterSliderProps) {
  const [inputValue, setInputValue] = useState(parameter.value.toString())

  // Variable type styling
  const getVarTypeStyle = () => {
    switch (parameter.varType) {
      case "MV":
        return {
          cardBg: "bg-gradient-to-br from-white to-amber-50/90 dark:from-slate-800 dark:to-amber-900/30",
          topBar: "from-amber-500 to-orange-500",
          ring: "ring-2 ring-amber-200/80 dark:ring-amber-900/60",
          badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
          iconColor: "text-amber-600",
          sliderColor: "amber"
        };
      case "DV":
        return {
          cardBg: "bg-gradient-to-br from-white to-emerald-50/90 dark:from-slate-800 dark:to-emerald-900/30",
          topBar: "from-emerald-500 to-green-500",
          ring: "ring-2 ring-emerald-200/80 dark:ring-emerald-900/60",
          badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
          iconColor: "text-emerald-600",
          sliderColor: "emerald"
        };
      default:
        return {
          cardBg: "bg-gradient-to-br from-white to-slate-50/90 dark:from-slate-800 dark:to-slate-900/30",
          topBar: "from-slate-500 to-slate-600",
          ring: "ring-2 ring-slate-200/80 dark:ring-slate-900/60",
          badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
          iconColor: "text-slate-600",
          sliderColor: "slate"
        };
    }
  };

  const style = getVarTypeStyle();

  const handleSliderChange = useCallback((values: number[]) => {
    const newValue = values[0];
    setInputValue(newValue.toFixed(2));
    onValueChange(parameter.id, newValue);
  }, [parameter.id, onValueChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
  }, []);

  const handleInputBlur = useCallback(() => {
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(parameter.min, Math.min(parameter.max, numValue));
      setInputValue(clampedValue.toFixed(2));
      onValueChange(parameter.id, clampedValue);
    } else {
      setInputValue(parameter.value.toFixed(2));
    }
  }, [inputValue, parameter.min, parameter.max, parameter.value, parameter.id, onValueChange]);

  const handleInputKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  }, [handleInputBlur]);

  return (
    <Card className={`shadow-lg border-0 ${style.cardBg} ${style.ring} backdrop-blur-sm overflow-hidden h-[400px] flex flex-col`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${style.topBar}`} />

      <CardHeader className="pb-2 flex-shrink-0">
        <div className="text-center">
          <CardTitle className="text-sm font-medium flex flex-col items-center gap-1">
            <span className={`text-lg ${style.iconColor}`}>🎛️</span>
            <span className="text-xs leading-tight">{parameter.name}</span>
          </CardTitle>
          <Badge variant="outline" className={`text-xs px-2 py-0.5 mt-1 ${style.badgeColor}`}>
            {parameter.varType}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col items-center justify-between py-4">
        {/* Current Value Display */}
        <div className="text-center mb-2">
          <div className="text-lg font-bold">{parameter.value.toFixed(2)}</div>
          <div className="text-xs text-slate-500">{parameter.unit}</div>
        </div>

        {/* Vertical Slider */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="h-[200px] flex items-center">
            <Slider
              orientation="vertical"
              value={[parameter.value]}
              onValueChange={handleSliderChange}
              min={parameter.min}
              max={parameter.max}
              step={0.1}
              disabled={disabled}
              className={`h-full ${
                style.sliderColor === 'amber' 
                  ? '[&_[data-orientation=vertical]]:bg-amber-200 [&_[role=slider]]:bg-amber-500 [&_[role=slider]]:border-amber-600'
                  : style.sliderColor === 'emerald'
                  ? '[&_[data-orientation=vertical]]:bg-emerald-200 [&_[role=slider]]:bg-emerald-500 [&_[role=slider]]:border-emerald-600'
                  : '[&_[data-orientation=vertical]]:bg-slate-200 [&_[role=slider]]:bg-slate-500 [&_[role=slider]]:border-slate-600'
              }`}
            />
          </div>
        </div>

        {/* Range Display */}
        <div className="text-center text-xs text-slate-500 mb-2">
          <div>Max: {parameter.max.toFixed(1)}</div>
          <div>Min: {parameter.min.toFixed(1)}</div>
        </div>

        {/* Input Field */}
        {showInput && (
          <div className="w-full">
            <Input
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyPress={handleInputKeyPress}
              disabled={disabled}
              className="text-center text-sm h-8"
              min={parameter.min}
              max={parameter.max}
              step={0.1}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
