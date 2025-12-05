"use client";
import AnimatedGif from "@/app/components/AnimatedGif";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Gauge } from "lucide-react";

import { MillInfoProps, TrendDataPoint } from "@/lib/hooks/useMills";
import { SemiCircleGaugeProps } from "./SemiCircleOreGauge";
import { SemiCircleOreGauge } from "./SemiCircleOreGauge";
import { TrendChartOre } from "./TrendChartOre";

// Function to process data points and remove extreme outliers
const processDataPoints = (values: number[]): number[] => {
  if (values.length <= 2) return values;

  // Calculate statistics
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;

  // Calculate standard deviation
  const squareDiffs = values.map((value) => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff =
    squareDiffs.reduce((acc, val) => acc + val, 0) / squareDiffs.length;
  const stdDev = Math.sqrt(avgSquareDiff);

  // Define threshold for outliers (3 standard deviations)
  const threshold = 3 * stdDev;

  // Replace outliers with the mean value to maintain type compatibility
  return values.map((value) => {
    if (Math.abs(value - mean) > threshold) {
      return mean;
    }
    return value;
  });
};

const MillInfo = ({
  millProps,
  oreTrend,
  onClick,
}: {
  millProps: MillInfoProps;
  oreTrend: TrendDataPoint[];
  onClick?: () => void;
}) => {
  const [gaugeData, setGaugeData] = useState<SemiCircleGaugeProps>({
    PV: 0,
    SP: 0,
    unit: "t/h",
    min: 0,
    max: 100,
    low: 0,
    high: 100,
  });

  useEffect(() => {
    // Update the gauge data based on the ore trend data
    if (oreTrend.length > 0) {
      const lastData = oreTrend[oreTrend.length - 1];
      const minValue = Math.min(...oreTrend.map((point) => point.value));
      const maxValue = Math.max(...oreTrend.map((point) => point.value));
      const range = maxValue - minValue;
      const padding = range * 0.3; // 30% padding

      setGaugeData({
        PV: lastData.value,
        SP: (maxValue + minValue) / 2,
        unit: "t/h",
        min: Math.max(0, minValue - padding),
        max: maxValue + padding,
        low: minValue,
        high: maxValue,
      });
    }
  }, [oreTrend]);

  const [showGraph, setShowGraph] = useState(true);

  return (
    <Card
      className="w-full h-full flex flex-col cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200"
      onClick={onClick}
    >
      <CardHeader className="pb-2 flex flex-col sm:flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg text-center sm:text-left">
          {millProps.title}
        </CardTitle>
        <div className="flex items-center gap-2">
          <TrendingUp
            className={`w-4 h-4 ${
              showGraph ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <Switch
            checked={showGraph}
            onCheckedChange={setShowGraph}
            aria-label="Toggle between trend chart and gauge"
          />
          <Gauge
            className={`w-4 h-4 ${
              !showGraph ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <AnimatedGif
          state={millProps.state}
          gifSrc="/images/mill_running.gif"
          jpgSrc="/images/mill_stopped.jpg"
          altText={`Mill status: ${millProps.state ? "Running" : "Stopped"}`}
        />
        <Table className="w-full">
          <TableBody className="grid grid-cols-[120px_1fr_40px]">
            <TableRow className="grid grid-cols-subgrid col-span-3 items-center py-1 border-b">
              <TableCell className="font-medium px-4">Смяна 1</TableCell>
              <TableCell className="px-4">
                <div className="flex items-center space-x-2">
                  <Progress
                    value={Math.min(
                      100,
                      ((millProps.shift1 || 0) / 1300) * 100
                    )}
                    className="h-3 bg-secondary flex-1 [&>div]:bg-blue-300"
                  />
                  <span className="whitespace-nowrap font-medium w-12 text-right">
                    {Math.round(millProps.shift1 || 0)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-medium text-center px-1">t</TableCell>
            </TableRow>
            <TableRow className="grid grid-cols-subgrid col-span-3 items-center py-1 border-b">
              <TableCell className="font-medium px-4">Смяна 2</TableCell>
              <TableCell className="px-4">
                <div className="flex items-center space-x-2">
                  <Progress
                    value={Math.min(
                      100,
                      ((millProps.shift2 || 0) / 1300) * 100
                    )}
                    className="h-3 bg-secondary flex-1 [&>div]:bg-blue-300"
                  />
                  <span className="whitespace-nowrap font-medium w-12 text-right">
                    {Math.round(millProps.shift2 || 0)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-medium text-center px-1">t</TableCell>
            </TableRow>
            <TableRow className="grid grid-cols-subgrid col-span-3 items-center py-1 border-b">
              <TableCell className="font-medium px-4">Смяна 3</TableCell>
              <TableCell className="px-4">
                <div className="flex items-center space-x-2">
                  <Progress
                    value={Math.min(
                      100,
                      ((millProps.shift3 || 0) / 1300) * 100
                    )}
                    className="h-3 bg-secondary flex-1 [&>div]:bg-blue-300"
                  />
                  <span className="whitespace-nowrap font-medium w-12 text-right">
                    {Math.round(millProps.shift3 || 0)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-medium text-center px-1">t</TableCell>
            </TableRow>
            <TableRow className="grid grid-cols-subgrid col-span-3 items-center py-1 border-b">
              <TableCell className="font-medium px-4">Тотал</TableCell>
              <TableCell className="px-4">
                <div className="flex items-center space-x-2">
                  <Progress
                    value={Math.min(100, ((millProps.total || 0) / 5000) * 100)}
                    className="h-3 bg-secondary flex-1 [&>div]:bg-green-300"
                  />
                  <span className="whitespace-nowrap font-medium w-12 text-right">
                    {Math.round(millProps.total || 0)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-medium text-center px-1">t</TableCell>
            </TableRow>
            <TableRow className="grid grid-cols-subgrid col-span-3 items-center py-1">
              <TableCell className="font-medium px-4">Лента</TableCell>
              <TableCell className="px-4">
                <div className="flex items-center space-x-2">
                  <Progress
                    value={Math.min(100, ((millProps.ore || 0) / 220) * 100)}
                    className="h-3 bg-secondary flex-1 [&>div]:bg-orange-300"
                  />
                  <span className="whitespace-nowrap font-medium w-12 text-right">
                    {Math.round(millProps.ore || 0)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-medium text-center px-1">
                t/h
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="w-full mt-auto flex-1 min-h-[180px]">
          {showGraph ? (
            <div className="h-full">
              <TrendChartOre
                data={{
                  // Process the data to filter out extreme outliers
                  values: processDataPoints(
                    oreTrend.map((point) => point.value)
                  ),
                  timestamps: oreTrend.map((point) => point.timestamp),
                  target: gaugeData.SP, // Use the setpoint as the target
                }}
                min={gaugeData.min}
                max={gaugeData.max}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
              <SemiCircleOreGauge {...gaugeData} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MillInfo;
