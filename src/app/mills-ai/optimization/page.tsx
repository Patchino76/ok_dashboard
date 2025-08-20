"use client"

import XgboostOptimizationDashboard from "./components/xgboost-optimization-dashboard"

export default function XgboostOptimizationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Multi-Parameter Process Control (Optimization)</h1>
        </div>
        <XgboostOptimizationDashboard />
      </div>
    </div>
  )
}
