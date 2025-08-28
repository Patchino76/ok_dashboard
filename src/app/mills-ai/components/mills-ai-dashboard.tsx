"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Brain, 
  Settings, 
  TrendingUp, 
  Target, 
  Zap, 
  Activity, 
  Database, 
  Cpu, 
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Clock,
  BarChart3,
  Cog,
  PlayCircle,
  PauseCircle,
  RefreshCw
} from "lucide-react"

interface SystemStatus {
  name: string
  status: "online" | "offline" | "warning"
  lastUpdate: string
  metrics?: { label: string; value: string }[]
}

interface ModelInfo {
  name: string
  accuracy: number
  lastTrained: string
  status: "active" | "training" | "idle"
  features: number
}

export function MillsAIDashboard() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([
    {
      name: "Mill 8 - Primary",
      status: "online",
      lastUpdate: "2 mins ago",
      metrics: [
        { label: "Throughput", value: "245 t/h" },
        { label: "Efficiency", value: "94.2%" },
        { label: "Power", value: "2.1 MW" }
      ]
    },
    {
      name: "Mill 7 - Secondary", 
      status: "online",
      lastUpdate: "3 mins ago",
      metrics: [
        { label: "Throughput", value: "198 t/h" },
        { label: "Efficiency", value: "91.8%" },
        { label: "Power", value: "1.8 MW" }
      ]
    },
    {
      name: "Mill 6 - Backup",
      status: "warning",
      lastUpdate: "15 mins ago",
      metrics: [
        { label: "Throughput", value: "156 t/h" },
        { label: "Efficiency", value: "87.3%" },
        { label: "Power", value: "1.6 MW" }
      ]
    }
  ])

  const [modelInfo, setModelInfo] = useState<ModelInfo[]>([
    {
      name: "XGBoost Primary",
      accuracy: 94.7,
      lastTrained: "2 hours ago",
      status: "active",
      features: 9
    },
    {
      name: "Neural Network",
      accuracy: 91.2,
      lastTrained: "6 hours ago", 
      status: "idle",
      features: 12
    },
    {
      name: "Ensemble Model",
      accuracy: 96.1,
      lastTrained: "1 day ago",
      status: "training",
      features: 15
    }
  ])

  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": case "active": return "text-green-600 bg-green-100 dark:bg-green-900/20"
      case "warning": case "training": return "text-orange-600 bg-orange-100 dark:bg-orange-900/20"
      case "offline": case "idle": return "text-slate-600 bg-slate-100 dark:bg-slate-900/20"
      default: return "text-slate-600 bg-slate-100"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online": case "active": return <CheckCircle className="h-4 w-4" />
      case "warning": case "training": return <AlertTriangle className="h-4 w-4" />
      case "offline": case "idle": return <Clock className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Mills AI Control Center
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Intelligent Milling Process Optimization & Control
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {mounted && currentTime ? currentTime.toLocaleString() : '--:--:--'}
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Active
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/mills-ai/simulation" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-xl hover:scale-105 border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-blue-600 rounded-lg">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <CardTitle className="text-xl font-semibold text-blue-900 dark:text-blue-100">
                XGBoost Simulation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Real-time process simulation with ML-powered predictions and parameter optimization.
              </p>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                  9 Parameters
                </Badge>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/mills-ai/optimization" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-xl hover:scale-105 border-0 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-purple-600 rounded-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-purple-600 transition-colors" />
              </div>
              <CardTitle className="text-xl font-semibold text-purple-900 dark:text-purple-100">
                Process Optimization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Advanced optimization algorithms to maximize efficiency and minimize costs.
              </p>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200">
                  Optuna
                </Badge>
                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200">
                  Training
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/mills-ai/model-training" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-xl hover:scale-105 border-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-green-600 rounded-lg">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-green-600 transition-colors" />
              </div>
              <CardTitle className="text-xl font-semibold text-green-900 dark:text-green-100">
                Model Training
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Train and validate machine learning models with historical process data.
              </p>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                  XGBoost
                </Badge>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                  Ready
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-slate-600" />
              Mill Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemStatus.map((system, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getStatusColor(system.status)}`}>
                    {getStatusIcon(system.status)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{system.name}</h4>
                    <p className="text-sm text-slate-500">Updated {system.lastUpdate}</p>
                  </div>
                </div>
                <div className="text-right">
                  {system.metrics && (
                    <div className="space-y-1">
                      {system.metrics.map((metric, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="text-slate-500">{metric.label}: </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{metric.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-slate-600" />
              ML Models Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {modelInfo.map((model, index) => (
              <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getStatusColor(model.status)}`}>
                      {getStatusIcon(model.status)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">{model.name}</h4>
                      <p className="text-sm text-slate-500">Trained {model.lastTrained}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(model.status)}>
                    {model.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Accuracy</span>
                    <span className="font-semibold">{model.accuracy}%</span>
                  </div>
                  <Progress value={model.accuracy} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Features</span>
                    <span className="font-semibold">{model.features}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="text-center p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <TrendingUp className="h-8 w-8 mx-auto mb-3" />
          <div className="text-3xl font-bold">94.2%</div>
          <div className="text-blue-100">Overall Efficiency</div>
        </Card>
        
        <Card className="text-center p-6 bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <BarChart3 className="h-8 w-8 mx-auto mb-3" />
          <div className="text-3xl font-bold">599</div>
          <div className="text-green-100">Tons/Hour</div>
        </Card>
        
        <Card className="text-center p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
          <Cog className="h-8 w-8 mx-auto mb-3" />
          <div className="text-3xl font-bold">5.5</div>
          <div className="text-purple-100">MW Power</div>
        </Card>
        
        <Card className="text-center p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
          <RefreshCw className="h-8 w-8 mx-auto mb-3" />
          <div className="text-3xl font-bold">99.7%</div>
          <div className="text-orange-100">Uptime</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-slate-600" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Export Reports
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Settings
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              View Alerts
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
