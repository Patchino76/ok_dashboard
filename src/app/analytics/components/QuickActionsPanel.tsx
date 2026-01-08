"use client";
import React, { useMemo } from "react";
import { AlertTriangle, TrendingDown, CheckCircle, Eye } from "lucide-react";
import { millsNames } from "@/lib/tags/mills-tags";

interface QuickActionsPanelProps {
  millsData: any;
  parameter: string;
  onViewMill?: (millName: string) => void;
}

interface MillAlert {
  millName: string;
  displayName: string;
  value: number;
  issue: "low" | "high" | "anomaly";
  deviation: number;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  millsData,
  parameter,
  onViewMill,
}) => {
  // Analyze mills data for alerts
  const { alerts, summary } = useMemo(() => {
    if (!millsData?.data || millsData.data.length === 0) {
      return { alerts: [], summary: { total: 0, issues: 0, ok: 0 } };
    }

    const latestRecord = millsData.data[millsData.data.length - 1];
    const millAlerts: MillAlert[] = [];
    const values: number[] = [];

    // Extract mill values
    Object.keys(latestRecord).forEach((key) => {
      if (key === "timestamp" || key === "parameter" || key === "freq") return;
      const value = parseFloat(latestRecord[key]);
      if (!isNaN(value)) {
        values.push(value);
      }
    });

    if (values.length === 0) {
      return { alerts: [], summary: { total: 0, issues: 0, ok: 0 } };
    }

    // Calculate stats
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    // Find mills with issues
    Object.keys(latestRecord).forEach((key) => {
      if (key === "timestamp" || key === "parameter" || key === "freq") return;
      const value = parseFloat(latestRecord[key]);
      if (isNaN(value)) return;

      const deviation = stdDev > 0 ? (value - mean) / stdDev : 0;
      const millNumber = parseInt(key.replace(/\D/g, ""));
      const displayName = millsNames[millNumber - 1]?.bg || `МА ${key}`;

      if (deviation < -1.5) {
        millAlerts.push({
          millName: key,
          displayName,
          value,
          issue: "low",
          deviation: Math.abs(deviation),
        });
      } else if (deviation > 1.5) {
        millAlerts.push({
          millName: key,
          displayName,
          value,
          issue: "high",
          deviation,
        });
      }
    });

    // Sort by deviation (most severe first)
    millAlerts.sort((a, b) => b.deviation - a.deviation);

    return {
      alerts: millAlerts.slice(0, 3), // Top 3 alerts
      summary: {
        total: values.length,
        issues: millAlerts.length,
        ok: values.length - millAlerts.length,
      },
    };
  }, [millsData]);

  if (!millsData?.data || millsData.data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Бърз преглед</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle className="w-3.5 h-3.5" />
            {summary.ok} нормални
          </span>
          {summary.issues > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              {summary.issues} изискват внимание
            </span>
          )}
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.millName}
              className={`flex items-center justify-between p-2 rounded-lg ${
                alert.issue === "low"
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {alert.issue === "low" ? (
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
                <div>
                  <span className="font-medium text-sm">
                    {alert.displayName}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {alert.value.toFixed(1)} (
                    {alert.issue === "low" ? "под" : "над"} средното)
                  </span>
                </div>
              </div>
              {onViewMill && (
                <button
                  onClick={() => onViewMill(alert.millName)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Виж
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="text-sm text-emerald-700">
            Всички мелници работят в нормални граници
          </span>
        </div>
      )}
    </div>
  );
};
