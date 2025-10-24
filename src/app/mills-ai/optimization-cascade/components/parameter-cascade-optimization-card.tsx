"use client";

import { memo } from "react";
import { MVParameterCard } from "./mv-parameter-card";
import { CVParameterCard } from "./cv-parameter-card";
import { DVParameterCard } from "./dv-parameter-card";
import type { CascadeParameter } from "../stores/cascade-optimization-store";

type BoundsTuple = [number, number];

type ParameterCardCommonProps = {
  parameter: CascadeParameter;
  bounds: BoundsTuple;
  rangeValue: BoundsTuple;
  proposedSetpoint?: number;
  distributionBounds?: BoundsTuple;
  distributionMedian?: number;
  distributionPercentiles?: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  onRangeChange: (id: string, range: BoundsTuple) => void;
  showDistributions: boolean;
  mvFeatures?: string[]; // Dynamic MV features from model metadata
  dvFeatures?: string[]; // Dynamic DV features from model metadata
};

const ParameterCascadeOptimizationCard = memo(
  ({
    parameter,
    bounds,
    rangeValue,
    proposedSetpoint,
    distributionBounds,
    distributionMedian,
    distributionPercentiles,
    onRangeChange,
    showDistributions,
    mvFeatures,
    dvFeatures,
  }: ParameterCardCommonProps) => {
    switch (parameter.varType) {
      case "MV":
        return (
          <MVParameterCard
            parameter={parameter}
            bounds={bounds}
            rangeValue={rangeValue}
            proposedSetpoint={proposedSetpoint}
            onRangeChange={onRangeChange}
            distributionBounds={distributionBounds}
            distributionMedian={distributionMedian}
            distributionPercentiles={distributionPercentiles}
            showDistributions={showDistributions}
            mvFeatures={mvFeatures}
          />
        );
      case "CV":
        return (
          <CVParameterCard
            parameter={parameter}
            bounds={bounds}
            rangeValue={rangeValue}
            proposedSetpoint={proposedSetpoint}
            distributionBounds={distributionBounds}
            distributionMedian={distributionMedian}
            distributionPercentiles={distributionPercentiles}
            showDistributions={showDistributions}
          />
        );
      case "DV":
      default:
        return <DVParameterCard parameter={parameter} bounds={bounds} dvFeatures={dvFeatures} />;
    }
  }
);

ParameterCascadeOptimizationCard.displayName = "ParameterCascadeOptimizationCard";

export default ParameterCascadeOptimizationCard;
