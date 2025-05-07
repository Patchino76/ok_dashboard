export interface TagDefinition {
  id: number;
  name: string;
  desc: string;
  unit: string;
  group: string;
  icon: string | null;
  state: string[] | null;
}

export interface TagValue {
  value: number | boolean | null;
  timestamp: string;
  active?: boolean;
}

export interface TagTrendPoint {
  timestamp: string;
  value: number | null;
}

export interface TagTrend {
  trend: TagTrendPoint[];
}
