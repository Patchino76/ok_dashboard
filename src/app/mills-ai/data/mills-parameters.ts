// mills-parameters.ts - Unified parameter definitions for Mills-AI components
import { create } from "zustand"

export interface ModelParameter {
  id: string
  name: string
  type: "feature" | "target"
  enabled: boolean
  min: number
  max: number
  currentMin: number
  currentMax: number
  unit: string
  description: string
}

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

// Unified parameter definitions with Bulgarian translations
export const millsParameters: ModelParameter[] = [
  {
    id: "Ore",
    name: "Разход на руда",
    type: "feature",
    enabled: true,
    min: 140,
    max: 240,
    currentMin: 170,
    currentMax: 200,
    unit: "t/h",
    description: "Разход на входяща руда към мелницата",
  },
  {
    id: "WaterMill",
    name: "Вода в мелницата",
    type: "feature",
    enabled: true,
    min: 5,
    max: 25,
    currentMin: 7,
    currentMax: 20,
    unit: "m³/h",
    description: "Разход на вода в мелницата",
  },
  {
    id: "WaterZumpf",
    name: "Вода в зумпфа",
    type: "feature",
    enabled: true,
    min: 140,
    max: 250,
    currentMin: 180,
    currentMax: 230,
    unit: "m³/h",
    description: "Разход на вода в зумпф",
  },
  {
    id: "MotorAmp",
    name: "Ток на елетродвигателя",
    type: "feature",
    enabled: true,
    min: 150,
    max: 250,
    currentMin: 180,
    currentMax: 220,
    unit: "A",
    description: "Консумация на ток от електродвигателя на мелницата",
  },
  {
    id: "DensityHC",
    name: "Плътност на ХЦ",
    type: "feature",
    enabled: true,
    min: 1200,
    max: 2000,
    currentMin: 1700,
    currentMax: 1900,
    unit: "g/L",
    description: "Плътност на пулп в хидроциклона",
  },
  {
    id: "PressureHC",
    name: "Налягане на ХЦ",
    type: "feature",
    enabled: true,
    min: 0.0,
    max: 0.6,
    currentMin: 0.3,
    currentMax: 0.5,
    unit: "bar",
    description: "Работно налягане в хидроциклона",
  },
  {
    id: "PumpRPM",
    name: "Обороти на помпата",
    type: "feature",
    enabled: true,
    min: 0,
    max: 800,
    currentMin: 650,
    currentMax: 780,
    unit: "rev/min",
    description: "Обороти на работната помпа",
  },
  {
    id: "Shisti",
    name: "Шисти",
    type: "feature",
    enabled: false,
    min: 0.0,
    max: 100.0,
    currentMin: 5.0,
    currentMax: 50.0,
    unit: "%",
    description: "Процентно съдържание на шисти в рудата",
  },
  {
    id: "Daiki",
    name: "Дайки",
    type: "feature",
    enabled: true,
    min: 0.0,
    max: 100.0,
    currentMin: 5.0,
    currentMax: 50.0,
    unit: "%",
    description: "Процентно съдържание на дайки в рудата",
  },
  {
    id: "Grano",
    name: "Гранодиорити",
    type: "feature",
    enabled: false,
    min: 0.0,
    max: 100.0,
    currentMin: 5.0,
    currentMax: 80.0,
    unit: "%",
    description: "Процентно съдържание на гранодиорити в рудата",
  },
  {
    id: "Class_12",
    name: "Клас 12",
    type: "feature",
    enabled: false,
    min: 0.0,
    max: 100.0,
    currentMin: 2.0,
    currentMax: 20.0,
    unit: "%",
    description: "Процент материал в клас +12 милиметра",
  },
  {
    id: "PSI80",
    name: "Фракция -80 μk",
    type: "target",
    enabled: true,
    min: 40,
    max: 65,
    currentMin: 45,
    currentMax: 56,
    unit: "μk",
    description: "Основна целева стойност - финност на смилане -80 микрона",
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
