"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useCascadeOptimizationStore } from "../stores/cascade-optimization-store";
import type { CascadeParameter } from "../stores/cascade-optimization-store";

interface DVParameterCardProps {
  parameter: CascadeParameter;
  bounds: [number, number]; // Initial bounds for slider min/max
}

export function DVParameterCard({ parameter, bounds }: DVParameterCardProps) {
  const { updateDVValue } = useCascadeOptimizationStore();
  const [sliderValue, setSliderValue] = useState<number>(parameter.value);

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    updateDVValue(parameter.id, value);
  };

  const [minBound, maxBound] = bounds;
  const sliderStep = (maxBound - minBound) / 100;

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-emerald-50/90 dark:from-slate-800 dark:to-emerald-900/30 ring-2 ring-emerald-200/80 dark:ring-emerald-900/60 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span className="text-xl text-emerald-600">{parameter.icon}</span>
              {parameter.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 border-emerald-200"
              >
                DV
              </Badge>
              <span className="text-xs text-slate-500">Disturbance</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Current Value Display */}
          <div className="flex-1 space-y-2">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Current Value
            </div>
            <div className="text-2xl font-bold flex items-center gap-1 text-emerald-600">
              {sliderValue.toFixed(2)}
              <span className="text-xs text-slate-500">{parameter.unit}</span>
            </div>
          </div>

          {/* Vertical Slider */}
          <div className="h-32 flex flex-col items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              {maxBound.toFixed(1)}
            </div>
            <div className="h-full flex items-center px-2">
              <Slider
                orientation="vertical"
                min={minBound}
                max={maxBound}
                step={sliderStep}
                value={[sliderValue]}
                onValueChange={([value]) => handleSliderChange(value)}
                className="h-[85%]"
                trackClassName="bg-emerald-100 dark:bg-emerald-950/50"
                rangeClassName="bg-emerald-500 dark:bg-emerald-400"
                thumbClassName="border-emerald-600 bg-white focus-visible:ring-emerald-300 dark:border-emerald-300 dark:bg-emerald-900"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {minBound.toFixed(1)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
