"use client";
import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ProcessHealthScoreProps {
  millsData: {
    millName: string;
    mean: number;
    stdDev: number;
    cv: number;
    trend: "up" | "down" | "stable";
  }[];
  globalMean: number;
  globalStdDev: number;
  globalCV: number;
  parameterName?: string;
  unit?: string;
}

interface HealthMetrics {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  status: string;
  color: string;
  bgColor: string;
  issues: string[];
  improvements: string[];
}

export const ProcessHealthScore: React.FC<ProcessHealthScoreProps> = ({
  millsData,
  globalMean,
  globalStdDev,
  globalCV,
  parameterName = "Параметър",
  unit = "",
}) => {
  const health = useMemo((): HealthMetrics => {
    let score = 100;
    const issues: string[] = [];
    const improvements: string[] = [];

    // 1. Check overall variability (CV) - max 30 points deduction
    if (globalCV > 20) {
      score -= 30;
      issues.push("Много висока вариабилност на процеса");
    } else if (globalCV > 15) {
      score -= 20;
      issues.push("Висока вариабилност на процеса");
    } else if (globalCV > 10) {
      score -= 10;
      issues.push("Умерена вариабилност");
    } else {
      improvements.push("Добра стабилност на процеса");
    }

    // 2. Check mills operating outside normal range - max 30 points deduction
    const outOfRangeMills = millsData.filter((m) => {
      const deviation = Math.abs(m.mean - globalMean) / globalStdDev;
      return deviation > 2;
    });

    if (outOfRangeMills.length > 0) {
      const deduction = Math.min(30, outOfRangeMills.length * 10);
      score -= deduction;
      issues.push(`${outOfRangeMills.length} мелници извън норма`);
    } else {
      improvements.push("Всички мелници в нормален диапазон");
    }

    // 3. Check for high variability mills - max 20 points deduction
    const highVarMills = millsData.filter((m) => m.cv > 15);
    if (highVarMills.length > 0) {
      const deduction = Math.min(20, highVarMills.length * 5);
      score -= deduction;
      issues.push(`${highVarMills.length} мелници с висока вариабилност`);
    }

    // 4. Check for negative trends - max 10 points deduction
    const decliningMills = millsData.filter((m) => m.trend === "down");
    if (decliningMills.length > millsData.length * 0.3) {
      score -= 10;
      issues.push("Много мелници с низходящ тренд");
    }

    // 5. Check uniformity between mills - max 10 points deduction
    const millMeans = millsData.map((m) => m.mean);
    const meanOfMeans = millMeans.reduce((a, b) => a + b, 0) / millMeans.length;
    const millVariance =
      millMeans.reduce((sum, m) => sum + Math.pow(m - meanOfMeans, 2), 0) /
      millMeans.length;
    const millStdDev = Math.sqrt(millVariance);
    const uniformityCV = (millStdDev / meanOfMeans) * 100;

    if (uniformityCV > 10) {
      score -= 10;
      issues.push("Голяма разлика между мелниците");
    } else {
      improvements.push("Добра еднородност между мелниците");
    }

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine grade
    let grade: HealthMetrics["grade"];
    let status: string;
    let color: string;
    let bgColor: string;

    if (score >= 90) {
      grade = "A";
      status = "Отличен";
      color = "text-green-600";
      bgColor = "bg-green-500";
    } else if (score >= 75) {
      grade = "B";
      status = "Добър";
      color = "text-blue-600";
      bgColor = "bg-blue-500";
    } else if (score >= 60) {
      grade = "C";
      status = "Задоволителен";
      color = "text-yellow-600";
      bgColor = "bg-yellow-500";
    } else if (score >= 40) {
      grade = "D";
      status = "Незадоволителен";
      color = "text-orange-600";
      bgColor = "bg-orange-500";
    } else {
      grade = "F";
      status = "Критичен";
      color = "text-red-600";
      bgColor = "bg-red-500";
    }

    return { score, grade, status, color, bgColor, issues, improvements };
  }, [millsData, globalMean, globalStdDev, globalCV]);

  // Calculate trend indicator
  const overallTrend = useMemo(() => {
    const upCount = millsData.filter((m) => m.trend === "up").length;
    const downCount = millsData.filter((m) => m.trend === "down").length;

    if (upCount > downCount + 2) return "up";
    if (downCount > upCount + 2) return "down";
    return "stable";
  }, [millsData]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-start justify-between">
        {/* Score display */}
        <div className="flex items-center gap-6">
          {/* Circular score */}
          <div className="relative">
            <svg className="w-28 h-28 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="56"
                cy="56"
                r="48"
                stroke="#e5e7eb"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="56"
                cy="56"
                r="48"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(health.score / 100) * 301.59} 301.59`}
                className={health.color}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${health.color}`}>
                {health.score}
              </span>
              <span className="text-xs text-gray-500">от 100</span>
            </div>
          </div>

          {/* Grade and status */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`${health.bgColor} text-white text-2xl font-bold w-10 h-10 rounded-lg flex items-center justify-center`}
              >
                {health.grade}
              </span>
              <div>
                <div className={`text-lg font-semibold ${health.color}`}>
                  {health.status}
                </div>
                <div className="text-sm text-gray-500">Здраве на процеса</div>
              </div>
            </div>

            {/* Trend indicator */}
            <div className="flex items-center gap-1 mt-2 text-sm">
              {overallTrend === "up" && (
                <>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">Възходящ тренд</span>
                </>
              )}
              {overallTrend === "down" && (
                <>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">Низходящ тренд</span>
                </>
              )}
              {overallTrend === "stable" && (
                <>
                  <Minus className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Стабилен</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">
              {globalMean.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">Средна {unit}</div>
          </div>
          <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">
              {globalCV.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Вариация (CV)</div>
          </div>
          <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">
              {millsData.length}
            </div>
            <div className="text-xs text-gray-500">Мелници</div>
          </div>
          <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">
              ±{globalStdDev.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">Ст. откл. {unit}</div>
          </div>
        </div>
      </div>

      {/* Issues and improvements */}
      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
        {/* Issues */}
        {health.issues.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Проблеми за внимание
            </h5>
            <ul className="space-y-1">
              {health.issues.map((issue, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-red-600"
                >
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {health.improvements.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Положителни аспекти
            </h5>
            <ul className="space-y-1">
              {health.improvements.map((improvement, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-green-600"
                >
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
