"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target,
  Sliders,
  Clock,
  TrendingUp,
  ArrowRight,
  Info,
} from "lucide-react";

interface OptimizationPreviewProps {
  targetValue: number;
  targetUnit: string;
  targetVariable: string;
  tolerance: number;
  mvCount: number;
  nTrials: number;
  mvBounds: Record<string, [number, number]>;
  isReady: boolean;
  onStartOptimization: () => void;
  onReset?: () => void;
  isOptimizing: boolean;
  resetLabel?: string;
}

export function OptimizationPreview({
  targetValue,
  targetUnit,
  targetVariable,
  tolerance,
  mvCount,
  nTrials,
  mvBounds,
  isReady,
  onStartOptimization,
  onReset,
  isOptimizing,
  resetLabel = "Нулиране",
}: OptimizationPreviewProps) {
  const estimatedTime = Math.ceil(nTrials * 0.05); // ~50ms per trial estimate

  const toleranceRange = {
    min: targetValue * (1 - tolerance / 100),
    max: targetValue * (1 + tolerance / 100),
  };

  return (
    <Card className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
      <div className="space-y-2">
        {/* Compact Summary - Single Row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Target */}
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-700">
              {targetValue.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">{targetUnit}</span>
          </div>

          <span className="text-slate-300">|</span>

          {/* Tolerance Range */}
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-600">
              {toleranceRange.min.toFixed(2)} - {toleranceRange.max.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">
              ±{tolerance.toFixed(1)}%
            </span>
          </div>

          <span className="text-slate-300">|</span>

          {/* MVs */}
          <div className="flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-sm font-bold text-amber-600">{mvCount}</span>
            <span className="text-xs text-slate-500">MV за оптимизация</span>
          </div>

          <span className="text-slate-300">|</span>

          {/* Time */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-sm font-bold text-purple-600">
              ~{estimatedTime}s
            </span>
            <span className="text-xs text-slate-400">{nTrials} опита</span>
          </div>
        </div>

        {/* MV Bounds - Inline */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-500">
            Граници за търсене на MV параметри:
          </span>
          {Object.entries(mvBounds).map(([paramId, bounds]) => (
            <Badge
              key={paramId}
              variant="outline"
              className="text-[10px] py-0 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
            >
              {paramId}: {bounds[0].toFixed(1)} - {bounds[1].toFixed(1)}
            </Badge>
          ))}
        </div>

        {/* Action Buttons - Horizontal */}
        <div className="flex gap-2">
          <Button
            onClick={onStartOptimization}
            disabled={!isReady || isOptimizing}
            className="flex-1 h-9 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            {isOptimizing ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Оптимизиране...
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-2" />
                Стартирай оптимизация
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
          {onReset && (
            <Button
              onClick={onReset}
              variant="outline"
              className="h-9 px-4 text-slate-700 border-slate-300 hover:bg-slate-50"
              disabled={isOptimizing}
            >
              {resetLabel}
            </Button>
          )}
        </div>

        {!isReady && (
          <div className="text-xs text-amber-600 dark:text-amber-400 text-center">
            ⚠️ Заредете модел, за да започнете оптимизация
          </div>
        )}
      </div>
    </Card>
  );
}

// Tolerance Presets Component
interface TolerancePresetsProps {
  currentTolerance: number;
  onToleranceChange: (value: number) => void;
  disabled?: boolean;
}

export function TolerancePresets({
  currentTolerance,
  onToleranceChange,
  disabled = false,
}: TolerancePresetsProps) {
  const presets = [
    {
      label: "Точен",
      value: 0.5,
      color: "bg-green-100 text-green-700 border-green-200 hover:bg-green-200",
    },
    {
      label: "Нормален",
      value: 1.0,
      color: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
    },
    {
      label: "Разхлабен",
      value: 2.0,
      color: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200",
    },
    {
      label: "Широк",
      value: 5.0,
      color: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Толеранс на целта</span>
        <span className="text-xs text-slate-500">
          ±{currentTolerance.toFixed(1)}%
        </span>
      </div>
      <div className="flex gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant="outline"
            size="sm"
            className={`flex-1 text-xs ${
              Math.abs(currentTolerance - preset.value) < 0.01
                ? preset.color
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
            onClick={() => onToleranceChange(preset.value)}
            disabled={disabled}
          >
            {preset.label}
            <span className="ml-1 text-[10px] opacity-70">
              ±{preset.value}%
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
