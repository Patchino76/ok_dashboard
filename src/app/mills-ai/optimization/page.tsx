"use client"

import XgboostOptimizationDashboard from "./components/xgboost-optimization-dashboard"

export default function XgboostOptimizationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Multi-Parameter Process Control (Optimization)</h1>
        </div>
        <XgboostOptimizationDashboard />
      </div>
    </div>
  )
}
