"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Target, Settings, TrendingUp, BarChart3, Zap } from "lucide-react";
import { useCascadeOptimizationStore } from "../stores/cascade-optimization-store";

interface TargetDrivenOptimizationControlsProps {
  onStartOptimization: () => void;
  isOptimizing: boolean;
  className?: string;
}

export function TargetDrivenOptimizationControls({
  onStartOptimization,
  isOptimizing,
  className,
}: TargetDrivenOptimizationControlsProps) {
  const {
    // Target-driven configuration
    targetValue,
    tolerance,
    confidenceLevel,
    isTargetDrivenMode,
    nTrials,
    targetVariable,
    
    // Actions
    setTargetValue,
    setTolerance,
    setConfidenceLevel,
    setTargetDrivenMode,
    setNTrials,
    
    // Results
    currentTargetResults,
    parameterDistributions,
    
    // Validation
    hasValidTargetConfiguration,
  } = useCascadeOptimizationStore();

  const tolerancePercent = tolerance * 100;
  const confidencePercent = confidenceLevel * 100;

  const handleToleranceChange = (value: number[]) => {
    setTolerance(value[0] / 100); // Convert percentage to fraction
  };

  const handleConfidenceLevelChange = (value: number[]) => {
    setConfidenceLevel(value[0] / 100); // Convert percentage to fraction
  };

  const targetRange = {
    min: targetValue * (1 - tolerance),
    max: targetValue * (1 + tolerance),
  };

  const hasDistributions = 
    Object.keys(parameterDistributions.mv_distributions).length > 0 ||
    Object.keys(parameterDistributions.cv_distributions).length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            <CardTitle>Target-Driven Optimization</CardTitle>
          </div>
          <Switch
            checked={isTargetDrivenMode}
            onCheckedChange={setTargetDrivenMode}
          />
        </div>
        <CardDescription>
          Find parameter distributions that achieve a specific target value
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Target Value Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-orange-500" />
            <Label className="text-sm font-medium">Target Configuration</Label>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-value" className="text-xs text-muted-foreground">
                Target {targetVariable} Value
              </Label>
              <Input
                id="target-value"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                step="0.1"
                min="0"
                max="100"
                className="h-8"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Target Range: ±{tolerancePercent.toFixed(1)}%
              </Label>
              <div className="text-xs text-muted-foreground">
                {targetRange.min.toFixed(2)} - {targetRange.max.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Tolerance Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Tolerance (±{tolerancePercent.toFixed(1)}%)
              </Label>
              <Badge variant="outline" className="text-xs">
                ±{tolerancePercent.toFixed(1)}%
              </Badge>
            </div>
            <Slider
              value={[tolerancePercent]}
              onValueChange={handleToleranceChange}
              min={0.1}
              max={10}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        <Separator />

        {/* Distribution Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <Label className="text-sm font-medium">Distribution Analysis</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Confidence Level ({confidencePercent.toFixed(0)}%)
              </Label>
              <Slider
                value={[confidencePercent]}
                onValueChange={handleConfidenceLevelChange}
                min={50}
                max={99}
                step={1}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="n-trials" className="text-xs text-muted-foreground">
                Optimization Trials
              </Label>
              <Input
                id="n-trials"
                type="number"
                value={nTrials}
                onChange={(e) => setNTrials(parseInt(e.target.value) || 100)}
                min="50"
                max="1000"
                step="50"
                className="h-8"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Results Summary */}
        {currentTargetResults && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <Label className="text-sm font-medium">Latest Results</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Target Achieved</div>
                <Badge variant={currentTargetResults.target_achieved ? "default" : "destructive"}>
                  {currentTargetResults.target_achieved ? "Yes" : "No"}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Success Rate</div>
                <div className="text-sm font-medium">
                  {(currentTargetResults.success_rate * 100).toFixed(1)}%
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Successful Trials</div>
                <div className="text-sm font-medium">
                  {currentTargetResults.successful_trials}/{currentTargetResults.total_trials}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Best Distance</div>
                <div className="text-sm font-medium">
                  {currentTargetResults.best_distance.toFixed(4)}
                </div>
              </div>
            </div>

            {hasDistributions && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Parameter Distributions</div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(parameterDistributions.mv_distributions).map((param) => (
                    <Badge key={param} variant="outline" className="text-xs">
                      {param} (MV)
                    </Badge>
                  ))}
                  {Object.keys(parameterDistributions.cv_distributions).map((param) => (
                    <Badge key={param} variant="secondary" className="text-xs">
                      {param} (CV)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Optimization Button */}
        <Button
          onClick={onStartOptimization}
          disabled={isOptimizing || !isTargetDrivenMode || !hasValidTargetConfiguration()}
          className="w-full"
          size="sm"
        >
          {isOptimizing ? (
            <>
              <Settings className="mr-2 h-4 w-4 animate-spin" />
              Optimizing for Target...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Find Parameter Distributions
            </>
          )}
        </Button>

        {!hasValidTargetConfiguration() && isTargetDrivenMode && (
          <div className="text-xs text-destructive">
            Please configure target value, parameter bounds, and DV values to enable optimization.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
