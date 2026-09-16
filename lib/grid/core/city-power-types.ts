export interface GridCityPowerCurvePoint {
  rawValue: number;
  attainmentBps: number;
}

export interface GridCityPowerComponentConfig {
  id: string;
  weightBps: number;
  rawCap: number;
  curve: GridCityPowerCurvePoint[];
}

export interface GridCityPowerConfig {
  maxSingleComponentWeightBps: number;
  components: GridCityPowerComponentConfig[];
}

export interface GridCityPowerBreakdown {
  id: string;
  rawValue: number;
  cappedRawValue: number;
  capped: boolean;
  attainmentBps: number;
  weightBps: number;
  contributedPowerBps: number;
}

export interface GridCityPowerProjection {
  cityPowerBps: number;
  breakdown: GridCityPowerBreakdown[];
  ignoredMetricIds: string[];
}

export type GridCityPowerMetrics = Record<string, number>;
