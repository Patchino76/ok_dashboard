export type DeliveryRow = {
  date: string;
  shift: number;
  target: number;
  type: string;
  weight: number;
  operator: string;
};

export type PieDatum = {
  name: string;
  value: number;
  color: string;
};

export type BarDatum = {
  target: string;
  value: number;
  color?: string;
};

export const deliveryData: DeliveryRow[] = [
  {
    date: "10, Dec, 2025 09:02",
    shift: 1,
    target: 12,
    type: "ф 80 stomana",
    weight: 2070.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 09:06",
    shift: 1,
    target: 2,
    type: "ф 80 stomana",
    weight: 2100.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 10:07",
    shift: 1,
    target: 10,
    type: "ф 80 polski",
    weight: 2000.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 10:45",
    shift: 1,
    target: 1,
    type: "ф 80 ispanski",
    weight: 2000.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 10:58",
    shift: 1,
    target: 9,
    type: "ф 80 ispanski",
    weight: 2000.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 10:41",
    shift: 1,
    target: 8,
    type: "ф 80 ispanski",
    weight: 1990.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 11:26",
    shift: 1,
    target: 7,
    type: "ф 80 polski",
    weight: 2000.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 11:25",
    shift: 1,
    target: 6,
    type: "ф 80 stomana",
    weight: 2180.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 11:50",
    shift: 1,
    target: 5,
    type: "ф 80 stomana",
    weight: 2100.0,
    operator: "Цветомир",
  },
  {
    date: "10, Dec, 2025 12:01",
    shift: 1,
    target: 3,
    type: "ф 80 stomana",
    weight: 2260.0,
    operator: "Цветомир",
  },
];

export const typeDistribution: PieDatum[] = [
  { name: "Испански ф80", value: 62.95, color: "#22c55e" },
  { name: "Полски ф80", value: 89.94, color: "#eab308" },
  { name: "Стояна ф70", value: 0, color: "#06b6d4" },
  { name: "Стояна ф90", value: 0, color: "#3b82f6" },
  { name: "Стояна ф80", value: 109.15, color: "#8b5cf6" },
  { name: "Чешки ф90", value: 0, color: "#f97316" },
];

export const targetDistribution: PieDatum[] = [
  { name: "Стояна ф60", value: 5.97, color: "#22c55e" },
  { name: "Уквайна ф30", value: 6.06, color: "#3b82f6" },
];

export const loadingByTarget: BarDatum[] = [
  { target: "МШЦ 01", value: 22.99, color: "#f97316" },
  { target: "МШЦ 02", value: 22.34, color: "#22c55e" },
  { target: "МШЦ 03", value: 22.21, color: "#22c55e" },
  { target: "МШЦ 04", value: 20, color: "#f97316" },
  { target: "МШЦ 05", value: 22.37, color: "#22c55e" },
  { target: "МШЦ 06", value: 22.08, color: "#22c55e" },
  { target: "МШЦ 07", value: 24.96, color: "#22c55e" },
  { target: "МШЦ 08", value: 22.98, color: "#f97316" },
  { target: "МШЦ 09", value: 23.97, color: "#f97316" },
  { target: "МШЦ 10", value: 24.98, color: "#22c55e" },
  { target: "МШЦ 11", value: 13.02, color: "#22c55e" },
];

export const oreProcessing: BarDatum[] = [
  { target: "МШЦ 01", value: 22.99 },
  { target: "МШЦ 02", value: 22.34 },
  { target: "МШЦ 03", value: 22.21 },
  { target: "МШЦ 04", value: 20 },
  { target: "МШЦ 05", value: 22.37 },
  { target: "МШЦ 06", value: 22.08 },
  { target: "МШЦ 07", value: 24.96 },
  { target: "МШЦ 08", value: 22.98 },
  { target: "МШЦ 09", value: 23.97 },
  { target: "МШЦ 10", value: 24.98 },
  { target: "МШЦ 11", value: 13.02 },
];
