"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SystemStatusBarProps {
  isModelLoaded: boolean;
  isRealTimeActive: boolean;
  isOptimizing: boolean;
  lastUpdated: number | null;
  dataStaleThresholdMs?: number;
  onRefresh?: () => void;
  modelName?: string;
  currentMill: number;
  featureCount: number;
}

export function SystemStatusBar({
  isModelLoaded,
  isRealTimeActive,
  isOptimizing,
  lastUpdated,
  dataStaleThresholdMs = 5 * 60 * 1000, // 5 minutes default
  onRefresh,
  modelName,
  currentMill,
  featureCount,
}: SystemStatusBarProps) {
  const now = Date.now();
  const isDataStale = lastUpdated
    ? now - lastUpdated > dataStaleThresholdMs
    : true;
  const timeSinceUpdate = lastUpdated
    ? Math.floor((now - lastUpdated) / 1000)
    : null;

  const formatTimeSince = (seconds: number | null) => {
    if (seconds === null) return "Няма данни";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  // Update every second for live time display
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Model Status */}
      <Badge
        variant="outline"
        className={`flex items-center gap-1.5 px-3 py-1.5 cursor-help ${
          isModelLoaded
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
        }`}
        title={
          isModelLoaded
            ? `Зареден модел: ${
                modelName || `cascade_mill_${currentMill}`
              } • ${featureCount} параметъра`
            : "Моделът не е зареден. Изберете мелница."
        }
      >
        {isModelLoaded ? (
          <CheckCircle className="h-3.5 w-3.5" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5" />
        )}
        <span className="text-xs font-medium">
          {isModelLoaded ? "Модел ✓" : "Няма модел"}
        </span>
      </Badge>

      {/* Real-time Data Status */}
      <Badge
        variant="outline"
        className={`flex items-center gap-1.5 px-3 py-1.5 cursor-help ${
          isRealTimeActive
            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
        }`}
        title={
          isRealTimeActive
            ? "Данните се актуализират автоматично на всеки 10 секунди"
            : "Real-time актуализациите са спрени"
        }
      >
        {isRealTimeActive ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        <span className="text-xs font-medium">
          {isRealTimeActive ? "Real-time ✓" : "Офлайн"}
        </span>
      </Badge>

      {/* Optimization Status */}
      <Badge
        variant="outline"
        className={`flex items-center gap-1.5 px-3 py-1.5 cursor-help ${
          isOptimizing
            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 animate-pulse"
            : isModelLoaded
            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
            : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
        }`}
        title={
          isOptimizing
            ? "Оптимизацията е в процес на изпълнение..."
            : isModelLoaded
            ? "Системата е готова за оптимизация"
            : "Заредете модел, за да започнете оптимизация"
        }
      >
        {isOptimizing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isModelLoaded ? (
          <Activity className="h-3.5 w-3.5" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5" />
        )}
        <span className="text-xs font-medium">
          {isOptimizing
            ? "Оптимизира..."
            : isModelLoaded
            ? "Готов ✓"
            : "Не е готов"}
        </span>
      </Badge>

      {/* Separator */}
      <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-1" />

      {/* Last Updated */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-help ${
          isDataStale && lastUpdated
            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "text-slate-500 dark:text-slate-400"
        }`}
        title={
          lastUpdated
            ? `Последна актуализация: ${new Date(
                lastUpdated
              ).toLocaleTimeString()}${
                isDataStale ? " ⚠️ Данните може да са остарели" : ""
              }`
            : "Данните все още не са заредени"
        }
      >
        <Clock className="h-3.5 w-3.5" />
        <span>
          {lastUpdated
            ? `Преди ${formatTimeSince(timeSinceUpdate)}`
            : "Няма данни"}
        </span>
        {isDataStale && lastUpdated && (
          <AlertCircle className="h-3 w-3 text-amber-500" />
        )}
      </div>

      {/* Refresh Button */}
      {onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          onClick={onRefresh}
          disabled={isOptimizing}
          title="Опресни данните"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isOptimizing ? "animate-spin" : ""}`}
          />
        </Button>
      )}
    </div>
  );
}
