"use client";
import React, { useMemo } from "react";
import { TrendChart } from "@/components/charts/trend/TrendChart";

interface TrendChartOreProps {
  data: {
    values: number[];
    timestamps: string[];
    target?: number;
  };
  min?: number;
  max?: number;
}

export const TrendChartOre: React.FC<TrendChartOreProps> = ({ data, min, max }) => {
  // Convert incoming data to a format suitable for the chart
  const convertedData = useMemo(() => {
    if (!data.values || !data.timestamps || data.values.length === 0) {
      return [];
    }
    
    // Create data points with timestamp and value
    return data.values.map((value, index) => ({
      timestamp: data.timestamps[index],
      value: value
    }));
  }, [data]);

  return (
    <TrendChart
      data={convertedData}
      color="#2563eb"
      height="100%"
      target={data.target}
      smoothing={true}
      showRegression={true}
      min={min}
      max={max}
      unit="t/h"
    />
  );
};
