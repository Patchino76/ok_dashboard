"use client"

import { CheckCircle, AlertTriangle } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface ConvergenceIndicatorProps {
  error: number
  errorPercentage: number
  isConverged: boolean
}

export function ConvergenceIndicator({ error, errorPercentage, isConverged }: ConvergenceIndicatorProps) {
  // Limit the error percentage for display purposes to a max of 100%
  const displayPercentage = Math.min(errorPercentage, 100)
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Convergence Status</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Process variable proximity to setpoint
          </p>
        </div>
        {isConverged ? (
          <CheckCircle className="h-8 w-8 text-green-600" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-orange-600" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Error Magnitude</span>
          <span className={`text-sm font-bold ${isConverged ? "text-green-600" : "text-orange-600"}`}>
            {Math.abs(error).toFixed(2)}
          </span>
        </div>
        <Progress
          value={100 - displayPercentage}
          className={`h-2 ${isConverged ? "bg-slate-200 dark:bg-slate-700" : "bg-orange-200 dark:bg-orange-900"}`}
        />
      </div>

      <div className="pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg text-center">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Error %</div>
            <div className={`text-xl font-bold ${isConverged ? "text-green-600" : "text-orange-600"}`}>
              {errorPercentage.toFixed(1)}%
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg text-center">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Status</div>
            <div className={`text-xl font-bold ${isConverged ? "text-green-600" : "text-orange-600"}`}>
              {isConverged ? "STABLE" : "UNSTABLE"}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
