// mills-parameters.ts - Unified parameter definitions and utilities for Mills-AI components
import { create } from "zustand"
import { ModelParameter } from "../types/parameters"

/**
 * Default list of model parameters with Bulgarian names and descriptions
 */

// Icons for parameters
export const parameterIcons: Record<string, string> = {
  Ore: "⛏️",
  WaterMill: "💧",
  WaterZumpf: "🌊",
  PressureHC: "📊",
  DensityHC: "🧪",
  MotorAmp: "⚡",
  Shisti: "🪨",
  Daiki: "🧬",
  PumpRPM: "🔄",
  Grano: "📏",
  Class_12: "🔢",
  PSI80: "🎯"
}

// Colors for parameters
export const parameterColors: Record<string, string> = {
  Ore: "amber",
  WaterMill: "blue",
  WaterZumpf: "cyan",
  PressureHC: "red",
  DensityHC: "purple",
  MotorAmp: "yellow",
  Shisti: "green",
  Daiki: "orange",
  PumpRPM: "indigo",
  Grano: "slate",
  Class_12: "rose",
  PSI80: "green"
}

// Helper function to calculate 10% inside ranges
const calculateDefaultRange = (min: number, max: number): [number, number] => {
  const range = max - min;
  const margin = range * 0.1; // 10% margin
  return [min + margin, max - margin];
};

// Unified parameter definitions with Bulgarian translations
export const millsParameters: ModelParameter[] = [
  {
    id: "Ore",
    name: "Разход на руда",
    type: "feature",
    enabled: true,
    filterEnabled: false, // Disabled by default for features
    min: 140,
    max: 240,
    currentMin: calculateDefaultRange(140, 240)[0], // 10% inside
    currentMax: calculateDefaultRange(140, 240)[1], // 10% inside
    unit: "t/h",
    isLab: false,
    description: "Разход на входяща руда към мелницата",
  },
  {
    id: "WaterMill",
    name: "Вода в мелницата",
    type: "feature",
    enabled: true,
    filterEnabled: false,
    min: 5,
    max: 25,
    currentMin: calculateDefaultRange(5, 25)[0],
    currentMax: calculateDefaultRange(5, 25)[1],
    unit: "m³/h",
    isLab: false,
    description: "Разход на вода в мелницата",
  },
  {
    id: "WaterZumpf",
    name: "Вода в зумпфа",
    type: "feature",
    enabled: true,
    filterEnabled: false,
    min: 140,
    max: 250,
    currentMin: calculateDefaultRange(140, 250)[0],
    currentMax: calculateDefaultRange(140, 250)[1],
    unit: "m³/h",
    isLab: false,
    description: "Разход на вода в зумпф",
  },
  {
    id: "PulpHC",
    name: "Пулп в ХЦ",
    type: "feature",
    enabled: true,
    filterEnabled: false,
    min: 400,
    max: 600,
    currentMin: calculateDefaultRange(400, 600)[0],
    currentMax: calculateDefaultRange(400, 600)[1],
    unit: "m³/h",
    isLab: false,
    description: "Разход на пулп в ХЦ",
  },
  {
    id: "MotorAmp",
    name: "Ток на елетродвигателя",
    type: "feature",
    enabled: true,
    filterEnabled: false,
    min: 150,
    max: 250,
    currentMin: calculateDefaultRange(150, 250)[0],
    currentMax: calculateDefaultRange(150, 250)[1],
    unit: "A",
    isLab: false,
    description: "Консумация на ток от електродвигателя на мелницата",
  },
  {
    id: "DensityHC",
    name: "Плътност на ХЦ",
    type: "feature",
    enabled: true,
    filterEnabled: false,
    min: 1200,
    max: 2000,
    currentMin: calculateDefaultRange(1200, 2000)[0],
    currentMax: calculateDefaultRange(1200, 2000)[1],
    unit: "kg/m³",
    isLab: false,
    description: "Плътност на пулп в хидроциклона",
  },
  {
    id: "PressureHC",
    name: "Налягане на ХЦ",
    type: "feature",
    enabled: true,
    filterEnabled: false,
    min: 0.0,
    max: 0.6,
    currentMin: calculateDefaultRange(0.0, 0.6)[0],
    currentMax: calculateDefaultRange(0.0, 0.6)[1],
    unit: "bar",
    isLab: false,
    description: "Работно налягане в хидроциклона",
  },
  {
    id: "PumpRPM",
    name: "Обороти на помпата",
    type: "feature",
    enabled: true,
    filterEnabled: false,
    min: 0,
    max: 800,
    currentMin: calculateDefaultRange(0, 800)[0],
    currentMax: calculateDefaultRange(0, 800)[1],
    unit: "rev/min",
    isLab: false,
    description: "Обороти на работната помпа",
  },
  {
    id: "Shisti",
    name: "Шисти",
    type: "feature",
    enabled: false,
    filterEnabled: false,
    min: 0.0,
    max: 100.0,
    currentMin: calculateDefaultRange(0.0, 100.0)[0],
    currentMax: calculateDefaultRange(0.0, 100.0)[1],
    unit: "%",
    isLab: true,
    description: "Процентно съдържание на шисти в рудата",
  },
  {
    id: "Daiki",
    name: "Дайки",
    type: "feature",
    enabled: true,
    filterEnabled: false,
    min: 0.0,
    max: 100.0,
    currentMin: calculateDefaultRange(0.0, 100.0)[0],
    currentMax: calculateDefaultRange(0.0, 100.0)[1],
    unit: "%",
    isLab: true,
    description: "Процентно съдържание на дайки в рудата",
  },
  {
    id: "Grano",
    name: "Гранодиорити",
    type: "feature",
    enabled: false,
    filterEnabled: false,
    min: 0.0,
    max: 100.0,
    currentMin: calculateDefaultRange(0.0, 100.0)[0],
    currentMax: calculateDefaultRange(0.0, 100.0)[1],
    unit: "%",
    isLab: true,
    description: "Процентно съдържание на гранодиорити в рудата",
  },
  {
    id: "Class_12",
    name: "Клас 12",
    type: "feature",
    enabled: false,
    filterEnabled: false,
    min: 0.0,
    max: 100.0,
    currentMin: calculateDefaultRange(0.0, 100.0)[0],
    currentMax: calculateDefaultRange(0.0, 100.0)[1],
    unit: "%",
    isLab: true,
    description: "Процент материал в клас +12 милиметра",
  },
  {
    id: "Class_15",
    name: "Клас 15",
    type: "feature",
    enabled: false,
    filterEnabled: false,
    min: 0.0,
    max: 100.0,
    currentMin: calculateDefaultRange(0.0, 100.0)[0],
    currentMax: calculateDefaultRange(0.0, 100.0)[1],
    unit: "%",
    isLab: true,
    description: "Процент материал в клас +15 милиметра",
  },
  {
    id: "PSI80",
    name: "PSI80",
    type: "target",
    enabled: true,
    filterEnabled: true, // Enabled by default for targets
    min: 0.0,
    max: 100.0,
    currentMin: calculateDefaultRange(0.0, 100.0)[0],
    currentMax: calculateDefaultRange(0.0, 100.0)[1],
    unit: "%",
    isLab: false,
    description: "Класификация на размерите на частиците при 80 микрона",
  },
  {
    id: "PSI200",
    name: "Фракция +200 μk",
    type: "target",
    enabled: false,
    filterEnabled: true, // Enabled by default for targets
    min: 10,
    max: 40,
    currentMin: calculateDefaultRange(10, 40)[0],
    currentMax: calculateDefaultRange(10, 40)[1],
    unit: "μk",
    description: "Основна целева стойност - финност на смилане +200 микрона",
  },
]

// Helper functions for parameters
export const getParameterDefaultValues = () => {
  return millsParameters.reduce((acc, param) => {
    acc[param.id] = (param.min + param.max) / 2;
    return acc;
  }, {} as Record<string, number>);
};

export const getParameterBounds = () => {
  return millsParameters.reduce((acc, param) => {
    acc[param.id] = [param.min, param.max];
    return acc;
  }, {} as Record<string, [number, number]>);
};

// Extract just the features or targets
export const getFeatures = () => millsParameters.filter(p => p.type === "feature");
export const getTargets = () => millsParameters.filter(p => p.type === "target");

// Helper to map parameters to the XGBoost store format
export const mapToStoreParameters = () => {
  return millsParameters.filter(p => p.type === "feature").map(param => ({
    id: param.id,
    name: param.name,
    unit: param.unit,
    value: (param.currentMin + param.currentMax) / 2,
    trend: [] as Array<{ timestamp: number; value: number }>,
    color: parameterColors[param.id] || "gray",
    icon: parameterIcons[param.id] || "📊"
  }));
};

// Custom hook to use parameters with state
export const useDefaultParameters = () => {
  return millsParameters;
};
