"use client";
import AnimatedGif from "@/app/components/AnimatedGif";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
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
  const squareDiffs = values.map(value => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / squareDiffs.length;
  const stdDev = Math.sqrt(avgSquareDiff);
  
  // Define threshold for outliers (3 standard deviations)
  const threshold = 3 * stdDev;
  
  // Replace outliers with the mean value to maintain type compatibility
  return values.map(value => {
    if (Math.abs(value - mean) > threshold) {
      return mean;
    }
    return value;
  });
};

const MillInfo = ({
  millProps,
  oreTrend,
}: {
  millProps: MillInfoProps;
  oreTrend: TrendDataPoint[];
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
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-2 text-center flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{millProps.title}</CardTitle>
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${showGraph ? 'text-primary' : 'text-muted-foreground'}`} />
          <Switch
            checked={showGraph}
            onCheckedChange={setShowGraph}
            aria-label="Toggle between trend chart and gauge"
          />
          <Gauge className={`w-4 h-4 ${!showGraph ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <AnimatedGif
          state={millProps.state}
          gifSrc="/images/mill_running.gif"
          jpgSrc="/images/mill_stopped.jpg"
          altText={`Mill status: ${millProps.state ? 'Running' : 'Stopped'}`}
        />
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Смяна 1</TableCell>
              <TableCell className="relative p-0 px-4">
                <div className="absolute left-0 top-10 h-2 bg-blue-100 z-0" 
                     style={{ width: `${Math.min(100, ((millProps.shift1 || 0) / 2000) * 100)}%` }} />
                <div className="relative z-10 py-4">{Math.round(millProps.shift1 || 0)}</div>
              </TableCell>
              <TableCell className="font-medium">t</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Смяна 2</TableCell>
              <TableCell className="relative p-0 px-4">
                <div className="absolute left-0 top-10 h-2 bg-blue-100 z-0" 
                     style={{ width: `${Math.min(100, ((millProps.shift2 || 0) / 2000) * 100)}%` }} />
                <div className="relative z-10 py-4">{Math.round(millProps.shift2 || 0)}</div>
              </TableCell>
              <TableCell className="font-medium">t</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Смяна 3</TableCell>
              <TableCell className="relative p-0 px-4">
                <div className="absolute left-0 top-10 h-2 bg-blue-100 z-0" 
                     style={{ width: `${Math.min(100, ((millProps.shift3 || 0) / 2000) * 100)}%` }} />
                <div className="relative z-10 py-4">{Math.round(millProps.shift3 || 0)}</div>
              </TableCell>
              <TableCell className="font-medium">t</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Тотал</TableCell>
              <TableCell className="relative p-0 px-4">
                <div className="absolute left-0 top-10 h-2 bg-green-100 z-0" 
                     style={{ width: `${Math.min(100, ((millProps.total || 0) / 6000) * 100)}%` }} />
                <div className="relative z-10 py-4">{Math.round(millProps.total || 0)}</div>
              </TableCell>
              <TableCell className="font-medium">t</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Лента</TableCell>
              <TableCell className="relative p-0 px-4">
                <div className="absolute left-0 top-10 h-2 bg-orange-100 z-0" 
                     style={{ width: `${Math.min(100, ((millProps.ore || 0) / 240) * 100)}%` }} />
                <div className="relative z-10 py-4">{Math.round(millProps.ore || 0)}</div>
              </TableCell>
              <TableCell className="font-medium">t/h</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="w-full" style={{ height: 200 }}>
          {showGraph ? (
            <TrendChartOre 
              data={{
                // Process the data to filter out extreme outliers
                values: processDataPoints(oreTrend.map(point => point.value)),
                timestamps: oreTrend.map(point => point.timestamp),
                target: gaugeData.SP, // Use the setpoint as the target
              }}
              min={gaugeData.min}
              max={gaugeData.max}
            />
          ) : (
            <div className="w-full h-full p-8">
              <SemiCircleOreGauge {...gaugeData} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MillInfo;
