export type WaterTone = "fresh" | "recycle" | "drain" | "power" | "tail";

export type Measurement = {
  name: string;
  value: string | number;
  unit?: string;
  tone?: WaterTone | "mine" | "pump";
  tag?: string;
  kind?: "pump";
  on?: boolean;
  station?: string;
  series?: { name: string; tag: string; color: string }[];
};
