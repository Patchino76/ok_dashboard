"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Zap, RotateCcw } from "lucide-react"

interface ControlPanelProps {
  isSimulationMode?: boolean
  onSimulationModeChange?: (isSimulation: boolean) => void
  onResetFeatures: () => void
  onPredict: () => void
  modelFeatures: string[] | null
  showRealtimeSwitch?: boolean
}

export function ControlPanel({
  isSimulationMode,
  onSimulationModeChange,
  onResetFeatures,
  onPredict,
  modelFeatures,
  showRealtimeSwitch = true
}: ControlPanelProps) {
  const [isPredicting, setIsPredicting] = useState(false);

  const handlePrediction = async () => {
    setIsPredicting(true);
    try {
      await onPredict();
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {showRealtimeSwitch && (
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Switch
                  id="simulation-mode"
                  checked={!Boolean(isSimulationMode)}
                  onCheckedChange={(checked) => onSimulationModeChange?.(!checked)}
                  className="mr-2"
                />
                <Label htmlFor="simulation-mode" className="text-sm font-medium">
                  Real-time Mode (PV)
                </Label>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onResetFeatures}
              disabled={!modelFeatures || modelFeatures.length === 0}
              className="h-9 px-3 rounded-md border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset Features SP
            </Button>
            <Button 
              onClick={handlePrediction}
              disabled={isPredicting}
              className="h-9 px-4 rounded-md bg-black text-white hover:bg-gray-800 dark:bg:white dark:text-black dark:hover:bg-gray-200"
            >
              <Zap className="h-4 w-4 mr-1" />
              {isPredicting ? "Predicting..." : "Predict Target"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

