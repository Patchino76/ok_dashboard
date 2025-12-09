"use client";

import React from "react";
import { millsTags } from "@/lib/tags/mills-tags";

// Define the parameter type
type Parameter = {
  value: string; // The actual parameter name as used in the API
  label: string; // English label
  labelBg: string; // Bulgarian label
  unit?: string; // Optional unit for the parameter
};

// Helper to derive unit from millsTags definitions so units stay in sync
const getUnitFromMillsTags = (parameterId: string): string | undefined => {
  type SimpleTagMeta = { unit?: string };
  const tagsForParam = (millsTags as Record<string, SimpleTagMeta[]>)[
    parameterId
  ];

  if (
    !tagsForParam ||
    !Array.isArray(tagsForParam) ||
    tagsForParam.length === 0
  ) {
    return undefined;
  }

  return tagsForParam[0]?.unit;
};

// Define all available parameters with translations
export const parameters: Parameter[] = [
  {
    value: "Ore",
    label: "Ore",
    labelBg: "Руда",
    unit: getUnitFromMillsTags("Ore") ?? "t/h",
  },
  {
    value: "WaterMill",
    label: "Water Mill",
    labelBg: "Вода мелница",
    unit: getUnitFromMillsTags("WaterMill") ?? "m³/h",
  },
  {
    value: "WaterZumpf",
    label: "Water Zumpf",
    labelBg: "Вода зумпф",
    unit: getUnitFromMillsTags("WaterZumpf") ?? "m³/h",
  },
  {
    value: "Power",
    label: "Power",
    labelBg: "Мощност",
    unit: getUnitFromMillsTags("Power") ?? "kW",
  },
  {
    value: "ZumpfLevel",
    label: "Zumpf Level",
    labelBg: "Ниво зумпф",
    unit: getUnitFromMillsTags("ZumpfLevel") ?? "%",
  },
  {
    value: "PressureHC",
    label: "Pressure HC",
    labelBg: "Налягане ХЦ",
    unit: getUnitFromMillsTags("PressureHC") ?? "bar",
  },
  {
    value: "DensityHC",
    label: "Density HC",
    labelBg: "Плътност ХЦ",
    unit: getUnitFromMillsTags("DensityHC") ?? "g/cm³",
  },
  {
    value: "PulpHC",
    label: "Pulp HC",
    labelBg: "Пулп ХЦ",
    unit: getUnitFromMillsTags("PulpHC") ?? "%",
  },
  {
    value: "PumpRPM",
    label: "Pump RPM",
    labelBg: "Обороти помпа",
    unit: getUnitFromMillsTags("PumpRPM") ?? "rpm",
  },
  {
    value: "MotorAmp",
    label: "Motor Amp",
    labelBg: "Ампераж мотор",
    unit: getUnitFromMillsTags("MotorAmp") ?? "A",
  },
  {
    value: "PSI80",
    label: "PSI 80",
    labelBg: "PSI 80",
    unit: getUnitFromMillsTags("PSI80") ?? "%",
  },
  {
    value: "PSI200",
    label: "PSI 200",
    labelBg: "PSI 200",
    unit: getUnitFromMillsTags("PSI200") ?? "%",
  },
];

// Helper function to get a parameter by its value
export const getParameterByValue = (value: string): Parameter | undefined => {
  return parameters.find((param) => param.value === value);
};

interface ParameterSelectorProps {
  selectedParameter: string;
  onParameterChange: (parameter: string) => void;
  showBulgarian?: boolean; // Option to show Bulgarian labels
}

export const ParameterSelector: React.FC<ParameterSelectorProps> = ({
  selectedParameter,
  onParameterChange,
  showBulgarian = true,
}) => {
  // Get the currently selected parameter
  const currentParameter = getParameterByValue(selectedParameter);

  // Handle selection change
  const handleChange = (value: string) => {
    onParameterChange(value);
  };

  return (
    <div className="relative">
      <select
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={selectedParameter}
        onChange={(e) => handleChange(e.target.value)}
      >
        {parameters.map((param) => (
          <option key={param.value} value={param.value}>
            {showBulgarian ? param.labelBg : param.label}
            {param.unit && ` (${param.unit})`}
          </option>
        ))}
      </select>
    </div>
  );
};
