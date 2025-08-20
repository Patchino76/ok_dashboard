"use client"

import XgboostSimulationDashboard from "./components/xgboost-simulation-dashboard"

export default function XgboostSimulationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Multi-Parameter Process Control</h1>
          {/* <p className="text-slate-600 dark:text-slate-400 mt-2">AI-Optimized Mill Control System</p> */}
        </div>
        <XgboostSimulationDashboard />
      </div>
    </div>
  )
}
