"use client";
import React from "react";

// Define the parameter type
type Parameter = {
  value: string;  // The actual parameter name as used in the API
  label: string;  // English label
  labelBg: string; // Bulgarian label
  unit?: string;  // Optional unit for the parameter
};

// Define all available parameters with translations
export const parameters: Parameter[] = [
  { value: "Ore", label: "Ore", labelBg: "Руда", unit: "t/h" },
  { value: "WaterMill", label: "Water Mill", labelBg: "Вода мелница", unit: "m³/h" },
  { value: "WaterZumpf", label: "Water Zumpf", labelBg: "Вода зумпф", unit: "m³/h" },
  { value: "Power", label: "Power", labelBg: "Мощност", unit: "kW" },
  { value: "ZumpfLevel", label: "Zumpf Level", labelBg: "Ниво зумпф", unit: "%" },
  { value: "PressureHC", label: "Pressure HC", labelBg: "Налягане ХЦ", unit: "bar" },
  { value: "DensityHC", label: "Density HC", labelBg: "Плътност ХЦ", unit: "g/cm³" },
  { value: "PulpHC", label: "Pulp HC", labelBg: "Пулп ХЦ", unit: "%" },
  { value: "PumpRPM", label: "Pump RPM", labelBg: "Обороти помпа", unit: "rpm" },
  { value: "MotorAmp", label: "Motor Amp", labelBg: "Ампераж мотор", unit: "A" },
  { value: "PSI80", label: "PSI 80", labelBg: "PSI 80", unit: "%" },
  { value: "PSI200", label: "PSI 200", labelBg: "PSI 200", unit: "%" },
];

// Helper function to get a parameter by its value
export const getParameterByValue = (value: string): Parameter | undefined => {
  return parameters.find(param => param.value === value);
};

interface ParameterSelectorProps {
  selectedParameter: string;
  onParameterChange: (parameter: string) => void;
  showBulgarian?: boolean; // Option to show Bulgarian labels
}

export const ParameterSelector: React.FC<ParameterSelectorProps> = ({
  selectedParameter,
  onParameterChange,
  showBulgarian = true
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
