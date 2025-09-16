/**
 * Helper functions to work with VariableClassifier data from backend
 * This mirrors the Python VariableClassifier structure
 */

export interface VariableInfo {
  id: string
  name: string
  type: 'MV' | 'CV' | 'DV' | 'TARGET'
  unit: string
  min_value: number
  max_value: number
  description: string
  enabled: boolean
}

// Variable mapping based on Python VariableClassifier
export const variableMapping: Record<string, VariableInfo> = {
  // Manipulated Variables (MVs) - what we control
  "Ore": {
    id: "Ore",
    name: "Разход на руда",
    type: "MV",
    unit: "t/h",
    min_value: 140,
    max_value: 240,
    description: "Разход на входяща руда към мелницата",
    enabled: true
  },
  "WaterMill": {
    id: "WaterMill",
    name: "Вода в мелницата",
    type: "MV",
    unit: "m³/h",
    min_value: 5,
    max_value: 25,
    description: "Разход на вода в мелницата",
    enabled: true
  },
  "WaterZumpf": {
    id: "WaterZumpf",
    name: "Вода в зумпфа",
    type: "MV",
    unit: "m³/h",
    min_value: 140,
    max_value: 250,
    description: "Разход на вода в зумпф",
    enabled: true
  },
  "MotorAmp": {
    id: "MotorAmp",
    name: "Ток на елетродвигателя",
    type: "MV",
    unit: "A",
    min_value: 150,
    max_value: 250,
    description: "Консумация на ток от електродвигателя на мелницата",
    enabled: true
  },

  // Controlled Variables (CVs) - what we measure
  "PulpHC": {
    id: "PulpHC",
    name: "Пулп в ХЦ",
    type: "CV",
    unit: "m³/h",
    min_value: 400,
    max_value: 600,
    description: "Разход на пулп в ХЦ",
    enabled: true
  },
  "DensityHC": {
    id: "DensityHC",
    name: "Плътност на ХЦ",
    type: "CV",
    unit: "kg/m³",
    min_value: 1200,
    max_value: 2000,
    description: "Плътност на пулп в хидроциклона",
    enabled: true
  },
  "PressureHC": {
    id: "PressureHC",
    name: "Налягане на ХЦ",
    type: "CV",
    unit: "bar",
    min_value: 0.0,
    max_value: 0.6,
    description: "Работно налягане в хидроциклона",
    enabled: true
  },
  "PumpRPM": {
    id: "PumpRPM",
    name: "Обороти на помпата",
    type: "CV",
    unit: "rev/min",
    min_value: 0,
    max_value: 800,
    description: "Обороти на работната помпа",
    enabled: false
  },

  // Disturbance Variables (DVs) - external factors
  "Shisti": {
    id: "Shisti",
    name: "Шисти",
    type: "DV",
    unit: "%",
    min_value: 0.0,
    max_value: 100.0,
    description: "Процентно съдържание на шисти в рудата",
    enabled: false
  },
  "Daiki": {
    id: "Daiki",
    name: "Дайки",
    type: "DV",
    unit: "%",
    min_value: 0.0,
    max_value: 100.0,
    description: "Процентно съдържание на дайки в рудата",
    enabled: false
  },
  "Grano": {
    id: "Grano",
    name: "Гранодиорити",
    type: "DV",
    unit: "%",
    min_value: 0.0,
    max_value: 100.0,
    description: "Процентно съдържание на гранодиорити в рудата",
    enabled: false
  },
  "Class_12": {
    id: "Class_12",
    name: "Клас 12",
    type: "DV",
    unit: "%",
    min_value: 0.0,
    max_value: 100.0,
    description: "Процент материал в клас +12 милиметра",
    enabled: false
  },
  "Class_15": {
    id: "Class_15",
    name: "Клас 15",
    type: "DV",
    unit: "%",
    min_value: 0.0,
    max_value: 100.0,
    description: "Процент материал в клас +15 милиметра",
    enabled: false
  },
  "FE": {
    id: "FE",
    name: "Желязо",
    type: "DV",
    unit: "%",
    min_value: 0.0,
    max_value: 0.6,
    description: "Процент съдържание на желязо в пулпа",
    enabled: false
  },

  // Target Variables
  "PSI80": {
    id: "PSI80",
    name: "Фракция -80 μk",
    type: "TARGET",
    unit: "%",
    min_value: 40,
    max_value: 60.0,
    description: "Класификация на размерите на частиците при 80 микрона",
    enabled: false
  },
  "PSI200": {
    id: "PSI200",
    name: "Фракция +200 μk",
    type: "TARGET",
    unit: "%",
    min_value: 10,
    max_value: 40,
    description: "Основна целева стойност - финност на смилане +200 микрона",
    enabled: true
  }
}

export function getVariablesByType(type: 'MV' | 'CV' | 'DV' | 'TARGET'): VariableInfo[] {
  return Object.values(variableMapping)
    .filter(variable => variable.type === type)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getEnabledVariablesByType(type: 'MV' | 'CV' | 'DV' | 'TARGET'): VariableInfo[] {
  return getVariablesByType(type).filter(variable => variable.enabled)
}

export function getAllVariablesByType(type: 'MV' | 'CV' | 'DV' | 'TARGET'): VariableInfo[] {
  return getVariablesByType(type)
}

export function getVariableInfo(id: string): VariableInfo | undefined {
  return variableMapping[id]
}

export function getMVs(): VariableInfo[] {
  return getVariablesByType('MV')
}

export function getCVs(): VariableInfo[] {
  return getVariablesByType('CV')
}

export function getDVs(): VariableInfo[] {
  return getVariablesByType('DV')
}

export function getTargets(): VariableInfo[] {
  return getVariablesByType('TARGET')
}
