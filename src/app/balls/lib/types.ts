export type DeliveryRow = {
  date: string;
  shift: number;
  target: number;
  type: string;
  weight: number;
  operator: string;
  isDosmilane: boolean;
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
  ballType?: string;
};
