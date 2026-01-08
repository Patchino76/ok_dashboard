"use client";

import React from "react";
import { ArrowRight, Zap } from "lucide-react";

interface CascadeMiniFlowProps {
  mvCount: number;
  cvCount: number;
  dvCount: number;
  targetVariable: string;
  isOptimizing?: boolean;
  hasResults?: boolean;
}

export function CascadeMiniFlow({
  mvCount,
  cvCount,
  dvCount,
  targetVariable,
  isOptimizing = false,
  hasResults = false,
}: CascadeMiniFlowProps) {
  return (
    <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
      {/* MVs */}
      <div className="flex flex-col items-center">
        <div
          className={`px-3 py-2 rounded-lg text-center transition-all ${
            isOptimizing
              ? "bg-amber-100 border-2 border-amber-400 animate-pulse"
              : hasResults
              ? "bg-amber-100 border-2 border-amber-500"
              : "bg-amber-50 border border-amber-200"
          }`}
        >
          <div className="text-lg font-bold text-amber-700">{mvCount}</div>
          <div className="text-xs text-amber-600 font-medium">MV</div>
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Контролирани</div>
      </div>

      {/* Arrow 1 */}
      <div className="flex flex-col items-center">
        <ArrowRight
          className={`h-5 w-5 ${
            isOptimizing ? "text-amber-500 animate-pulse" : "text-slate-400"
          }`}
        />
        <div className="text-[9px] text-slate-400">влияят</div>
      </div>

      {/* CVs */}
      <div className="flex flex-col items-center">
        <div
          className={`px-3 py-2 rounded-lg text-center transition-all ${
            isOptimizing
              ? "bg-blue-100 border-2 border-blue-400 animate-pulse"
              : hasResults
              ? "bg-blue-100 border-2 border-blue-500"
              : "bg-blue-50 border border-blue-200"
          }`}
        >
          <div className="text-lg font-bold text-blue-700">{cvCount}</div>
          <div className="text-xs text-blue-600 font-medium">CV</div>
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Прогнозирани</div>
      </div>

      {/* DVs (if any) */}
      {dvCount > 0 && (
        <>
          <div className="text-slate-300 text-lg">+</div>
          <div className="flex flex-col items-center">
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <div className="text-lg font-bold text-emerald-700">
                {dvCount}
              </div>
              <div className="text-xs text-emerald-600 font-medium">DV</div>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Смущения</div>
          </div>
        </>
      )}

      {/* Arrow 2 */}
      <div className="flex flex-col items-center">
        <ArrowRight
          className={`h-5 w-5 ${
            isOptimizing ? "text-purple-500 animate-pulse" : "text-slate-400"
          }`}
        />
        <div className="text-[9px] text-slate-400">определят</div>
      </div>

      {/* Target */}
      <div className="flex flex-col items-center">
        <div
          className={`px-4 py-2 rounded-lg text-center transition-all ${
            isOptimizing
              ? "bg-purple-100 border-2 border-purple-400 animate-pulse"
              : hasResults
              ? "bg-purple-100 border-2 border-purple-500 ring-2 ring-purple-300"
              : "bg-purple-50 border border-purple-200"
          }`}
        >
          <Zap
            className={`h-4 w-4 mx-auto ${
              hasResults ? "text-purple-600" : "text-purple-400"
            }`}
          />
          <div className="text-xs text-purple-600 font-bold mt-1">
            {targetVariable}
          </div>
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Цел</div>
      </div>
    </div>
  );
}
