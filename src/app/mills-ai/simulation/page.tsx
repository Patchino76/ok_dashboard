"use client"

import XgboostSimulationDashboard from "./components/xgboost-simulation-dashboard"

export default function XgboostSimulationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-4">
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
