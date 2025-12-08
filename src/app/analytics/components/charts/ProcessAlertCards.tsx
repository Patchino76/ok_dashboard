"use client";
import React, { useMemo } from "react";
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface MillData {
  millName: string;
  displayName: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  trend: "up" | "down" | "stable";
  trendData: number[];
  cv: number;
}

interface ProcessAlertCardsProps {
  millsData: MillData[];
  globalMean: number;
  globalStdDev: number;
  unit?: string;
  onMillClick?: (millName: string) => void;
}

interface Alert {
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  mills: string[];
  icon: React.ReactNode;
  action?: string;
}

export const ProcessAlertCards: React.FC<ProcessAlertCardsProps> = ({
  millsData,
  globalMean,
  globalStdDev,
  unit = "",
  onMillClick,
}) => {
  const alerts = useMemo((): Alert[] => {
    const alertList: Alert[] = [];

    // Check for mills operating outside normal range (>2σ from mean)
    const outOfRangeMills = millsData.filter((m) => {
      const deviation = Math.abs(m.mean - globalMean) / globalStdDev;
      return deviation > 2;
    });

    if (outOfRangeMills.length > 0) {
      alertList.push({
        type: "critical",
        title: `${outOfRangeMills.length} мелници извън норма`,
        description: "Работят с голямо отклонение от средното (>2σ)",
        mills: outOfRangeMills.map((m) => m.displayName),
        icon: <XCircle className="w-5 h-5" />,
        action: "Проверете настройките",
      });
    }

    // Check for mills with high variability (CV > 15%)
    const highVariabilityMills = millsData.filter((m) => m.cv > 15);

    if (highVariabilityMills.length > 0) {
      alertList.push({
        type: "warning",
        title: `${highVariabilityMills.length} мелници с висока вариабилност`,
        description: "Коефициент на вариация над 15%",
        mills: highVariabilityMills.map((m) => m.displayName),
        icon: <Activity className="w-5 h-5" />,
        action: "Стабилизирайте процеса",
      });
    }

    // Check for downward trending mills
    const decliningMills = millsData.filter((m) => m.trend === "down");

    if (decliningMills.length > 0) {
      alertList.push({
        type: "warning",
        title: `${decliningMills.length} мелници с низходящ тренд`,
        description: "Показват намаляване на стойностите",
        mills: decliningMills.map((m) => m.displayName),
        icon: <TrendingDown className="w-5 h-5" />,
        action: "Следете развитието",
      });
    }

    // Check for upward trending mills (might be good or bad depending on parameter)
    const risingMills = millsData.filter((m) => m.trend === "up");

    if (risingMills.length > 0) {
      alertList.push({
        type: "info",
        title: `${risingMills.length} мелници с възходящ тренд`,
        description: "Показват увеличение на стойностите",
        mills: risingMills.map((m) => m.displayName),
        icon: <TrendingUp className="w-5 h-5" />,
      });
    }

    // Check for mills with extreme values
    const extremeValueMills = millsData.filter((m) => {
      const range = m.max - m.min;
      const expectedRange = 4 * m.stdDev; // Expect ~95% within ±2σ
      return range > expectedRange * 1.5;
    });

    if (extremeValueMills.length > 0) {
      alertList.push({
        type: "warning",
        title: `${extremeValueMills.length} мелници с екстремни стойности`,
        description: "Имат много широк диапазон на стойностите",
        mills: extremeValueMills.map((m) => m.displayName),
        icon: <AlertTriangle className="w-5 h-5" />,
        action: "Проверете за аномалии",
      });
    }

    // If no issues, show positive message
    if (alertList.length === 0) {
      alertList.push({
        type: "info",
        title: "Всички мелници работят нормално",
        description: "Няма открити проблеми в процеса",
        mills: [],
        icon: <CheckCircle className="w-5 h-5" />,
      });
    }

    return alertList;
  }, [millsData, globalMean, globalStdDev]);

  const getAlertStyles = (type: Alert["type"]) => {
    switch (type) {
      case "critical":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          icon: "text-red-600",
          title: "text-red-800",
          text: "text-red-700",
          badge: "bg-red-100 text-red-700",
          button: "bg-red-600 hover:bg-red-700 text-white",
        };
      case "warning":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: "text-amber-600",
          title: "text-amber-800",
          text: "text-amber-700",
          badge: "bg-amber-100 text-amber-700",
          button: "bg-amber-600 hover:bg-amber-700 text-white",
        };
      case "info":
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: "text-blue-600",
          title: "text-blue-800",
          text: "text-blue-700",
          badge: "bg-blue-100 text-blue-700",
          button: "bg-blue-600 hover:bg-blue-700 text-white",
        };
    }
  };

  // Count by severity
  const criticalCount = alerts.filter((a) => a.type === "critical").length;
  const warningCount = alerts.filter((a) => a.type === "warning").length;

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">
          Сигнали за процеса
        </h4>
        <div className="flex gap-2 text-xs">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
              {criticalCount} критични
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              {warningCount} внимание
            </span>
          )}
        </div>
      </div>

      {/* Alert cards */}
      <div className="space-y-2">
        {alerts.map((alert, index) => {
          const styles = getAlertStyles(alert.type);
          return (
            <div
              key={index}
              className={`${styles.bg} ${styles.border} border rounded-lg p-3`}
            >
              <div className="flex items-start gap-3">
                <div className={`${styles.icon} mt-0.5`}>{alert.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className={`font-semibold ${styles.title}`}>
                      {alert.title}
                    </h5>
                    {alert.action && (
                      <button
                        className={`${styles.button} px-2 py-1 rounded text-xs font-medium transition-colors`}
                      >
                        {alert.action}
                      </button>
                    )}
                  </div>
                  <p className={`text-sm ${styles.text} mt-0.5`}>
                    {alert.description}
                  </p>
                  {alert.mills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {alert.mills.map((mill, i) => (
                        <button
                          key={i}
                          onClick={() => onMillClick?.(mill)}
                          className={`${styles.badge} px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 transition-opacity cursor-pointer`}
                        >
                          {mill}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
