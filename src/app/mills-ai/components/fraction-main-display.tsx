"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { CheckCircle, AlertTriangle, Target, TrendingUp } from "lucide-react"

interface FractionData {
  timestamp: number
  value: number
  target: number
}

interface FractionMainDisplayProps {
  currentFraction: number
  targetFraction: number
  fractionData: FractionData[]
  isOptimal: boolean
  onTargetChange: (value: number) => void
}

export function FractionMainDisplay({
  currentFraction,
  targetFraction,
  fractionData,
  isOptimal,
  onTargetChange,
}: FractionMainDisplayProps) {
  const [editTarget, setEditTarget] = useState(false)
  const [tempTarget, setTempTarget] = useState(targetFraction.toString())

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
      .getSeconds()
      .toString()
      .padStart(2, "0")}`
  }

  const handleSubmitTarget = () => {
    const newTarget = parseFloat(tempTarget)
    if (!isNaN(newTarget) && newTarget > 0 && newTarget <= 100) {
      onTargetChange(newTarget)
    }
    setEditTarget(false)
  }

  const errorValue = Math.abs(currentFraction - targetFraction)

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Mill Recovery Fraction
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isOptimal ? "default" : "destructive"} className="px-3 py-1">
              {isOptimal ? "OPTIMAL" : "OPTIMIZING"}
            </Badge>
            {isOptimal ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Main Values Display */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <div className="space-y-6">
              {/* Current Fraction */}
              <div>
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Fraction</Label>
                <div className="mt-1 flex items-end">
                  <span className="text-4xl font-bold text-blue-600">{currentFraction.toFixed(1)}</span>
                  <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">%</span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Recovery rate of valuable material
                </div>
              </div>

              {/* Target Fraction */}
              <div>
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Target Fraction</Label>
                {editTarget ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="number"
                      value={tempTarget}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempTarget(e.target.value)}
                      className="max-w-[120px]"
                      step={0.1}
                      min={0}
                      max={100}
                    />
                    <Button size="sm" onClick={handleSubmitTarget}>
                      Set
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditTarget(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-end">
                    <span className="text-3xl font-bold text-green-600">{targetFraction.toFixed(1)}</span>
                    <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">%</span>
                    <Button size="sm" variant="ghost" className="ml-2 p-1 h-auto" onClick={() => setEditTarget(true)}>
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              {/* Error Display */}
              <div className="pt-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">Error</Label>
                  <span
                    className={`text-sm font-medium ${
                      isOptimal ? "text-green-600" : "text-orange-600"
                    }`}
                  >
                    {errorValue.toFixed(1)}%
                  </span>
                </div>
                <div className="relative h-2 w-full bg-slate-200 dark:bg-slate-700 mt-1 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full ${
                      isOptimal ? "bg-green-600" : "bg-orange-600"
                    } transition-all duration-500`}
                    style={{ width: `${Math.min(100, 100 - errorValue * 10)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Fraction Trend</span>
              </div>

              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fractionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTime}
                      stroke="#6b7280"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      domain={[
                        (dataMin: number) => Math.floor(dataMin - 2),
                        (dataMax: number) => Math.ceil(dataMax + 2),
                      ]}
                    />
                    <Tooltip
                      labelFormatter={formatTime}
                      contentStyle={{ background: "#1f2937", borderColor: "#374151", color: "#e5e7eb" }}
                      itemStyle={{ color: "#e5e7eb" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Actual"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      animationDuration={300}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Target"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="3 3"
                      animationDuration={300}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
