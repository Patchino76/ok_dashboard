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
  onRangeChange: (id: string, range: BoundsTuple) => void;
};

const ParameterCascadeOptimizationCard = memo(
  ({
    parameter,
    bounds,
    rangeValue,
    proposedSetpoint,
    distributionBounds,
    distributionMedian,
    onRangeChange,
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
          />
        );
      case "DV":
      default:
        return <DVParameterCard parameter={parameter} />;
    }
  }
);

ParameterCascadeOptimizationCard.displayName = "ParameterCascadeOptimizationCard";

export default ParameterCascadeOptimizationCard;
