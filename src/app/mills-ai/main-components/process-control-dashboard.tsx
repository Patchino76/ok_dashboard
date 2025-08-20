"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ProcessTrendChart } from "./process-trend-chart"
import { VerticalGauge } from "./vertical-gauge"
import { ConvergenceIndicator } from "./convergence-indicator"
import { TrendingUp, Settings, Zap, Target, AlertTriangle, CheckCircle } from "lucide-react"

interface ProcessData {
  timestamp: number
  pv: number
  sp: number
  aiSp: number
}

interface ProcessControlDashboardProps {
  unit?: string
}

export function ProcessControlDashboard({ unit = "°C" }: ProcessControlDashboardProps = {}) {
  const [processData, setProcessData] = useState<ProcessData[]>([])
  const [currentPV, setCurrentPV] = useState(45.2)
  const [currentSP, setCurrentSP] = useState(50.0)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [spLowLimit, setSpLowLimit] = useState([20])
  const [spHighLimit, setSpHighLimit] = useState([80])
  const [manualSP, setManualSP] = useState(50.0)

  // Simulate real-time process data
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const aiSp = aiEnabled
        ? Math.max(spLowLimit[0], Math.min(spHighLimit[0], currentSP + (Math.random() - 0.5) * 2))
        : manualSP

      // Simulate PV trying to follow SP with some lag and noise
      const error = aiSp - currentPV
      const newPV = currentPV + error * 0.1 + (Math.random() - 0.5) * 1.5

      setCurrentPV(newPV)
      setCurrentSP(aiSp)

      setProcessData((prev) => {
        const newData = [
          ...prev,
          {
            timestamp: now,
            pv: newPV,
            sp: aiSp,
            aiSp: aiSp,
          },
        ].slice(-50) // Keep last 50 points
        return newData
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentPV, currentSP, aiEnabled, spLowLimit, spHighLimit, manualSP])

  const error = currentSP - currentPV
  const errorPercentage = (Math.abs(error) / currentSP) * 100
  const isConverged = Math.abs(error) < 2.0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main Trend Chart */}
      <Card className="lg:col-span-2 shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Mill Process Trend
            </CardTitle>
            <Badge variant={isConverged ? "default" : "destructive"} className="px-3 py-1">
              {isConverged ? "Converged" : "Diverged"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ProcessTrendChart data={processData} />
        </CardContent>
      </Card>

      {/* Vertical Gauges */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            Mill Variables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-around items-center h-80">
            <div className="text-center">
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">PV (Current)</Label>
              <VerticalGauge value={currentPV} min={0} max={100} label="PV" color="blue" unit={unit} />
              <div className="mt-2 text-lg font-bold text-blue-600">{currentPV.toFixed(1)}{unit}</div>
            </div>
            <div className="text-center">
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">SP (Target)</Label>
              <VerticalGauge value={currentSP} min={0} max={100} label="SP" color="green" unit={unit} />
              <div className="mt-2 text-lg font-bold text-green-600">{currentSP.toFixed(1)}{unit}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Convergence Indicator */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {isConverged ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            )}
            Convergence Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConvergenceIndicator error={error} errorPercentage={errorPercentage} isConverged={isConverged} />
        </CardContent>
      </Card>

      {/* AI Control Panel */}
      <Card className="lg:col-span-2 shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            AI Mill Setpoint Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-mode">AI Control Mode</Label>
              <Badge variant={aiEnabled ? "default" : "secondary"}>{aiEnabled ? "ENABLED" : "MANUAL"}</Badge>
            </div>
            <Switch id="ai-mode" checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>

          <Separator />

          {aiEnabled ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">SP Low Limit: {spLowLimit[0]}{unit}</Label>
                <Slider value={spLowLimit} onValueChange={setSpLowLimit} max={100} min={0} step={1} className="mt-2" />
              </div>
              <div>
                <Label className="text-sm font-medium">SP High Limit: {spHighLimit[0]}{unit}</Label>
                <Slider
                  value={spHighLimit}
                  onValueChange={setSpHighLimit}
                  max={100}
                  min={0}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="manual-sp" className="text-sm font-medium">
                Manual Setpoint
              </Label>
              <Input
                id="manual-sp"
                type="number"
                value={manualSP}
                onChange={(e) => setManualSP(Number.parseFloat(e.target.value) || 0)}
                className="mt-2"
                min={0}
                max={100}
                step={0.1}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card className="lg:col-span-2 shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-600" />
            Mill System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.abs(error).toFixed(1)}{unit}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Absolute Error</div>
            </div>
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{errorPercentage.toFixed(1)}%</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Error Percentage</div>
            </div>
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{processData.length}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Data Points</div>
            </div>
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className={`text-2xl font-bold ${isConverged ? "text-green-600" : "text-orange-600"}`}>
                {isConverged ? "STABLE" : "ACTIVE"}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Control Status</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
