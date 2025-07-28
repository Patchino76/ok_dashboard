/**
 * Shared model parameter interface and default parameter list for mills-ai components
 */

/**
 * Interface representing a model parameter used for ML model training and prediction
 */
export interface ModelParameter {
  /** Unique identifier for the parameter */
  id: string;
  /** Display name in Bulgarian */
  name: string;
  /** Parameter type: 'feature' (input) or 'target' (output) */
  type: "feature" | "target";
  /** Whether the parameter is enabled/selected for use */
  enabled: boolean;
  /** Absolute minimum value possible for this parameter */
  min: number;
  /** Absolute maximum value possible for this parameter */
  max: number;
  /** Current minimum value selected for training/prediction */
  currentMin: number;
  /** Current maximum value selected for training/prediction */
  currentMax: number;
  /** Measurement unit (e.g., t/h, m³/h) */
  unit: string;
  /** Description of the parameter in Bulgarian */
  description: string;
}

/**
 * Default list of model parameters with Bulgarian names and descriptions
 */
export const defaultModelParameters: ModelParameter[] = [
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
    id: "PulpHC",
    name: "Пулп в ХЦ",
    type: "feature",
    enabled: true,
    min: 400,
    max: 600,
    currentMin: 450,
    currentMax: 550,
    unit: "m³/h",
    description: "Разход на пулп в ХЦ",
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
];
