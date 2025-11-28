"use client";
import React, { useMemo } from "react";
import { millsNames } from "@/lib/tags/mills-tags";

interface CorrelationHeatmapProps {
  millsData: Record<string, number[]>;
  title?: string;
}

interface CorrelationCell {
  mill1: string;
  mill2: string;
  correlation: number;
  displayName1: string;
  displayName2: string;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  millsData,
  title = "Корелационна матрица",
}) => {
  const { correlationMatrix, mills } = useMemo(() => {
    const mills = Object.keys(millsData).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""));
      const numB = parseInt(b.replace(/\D/g, ""));
      return numA - numB;
    });

    if (mills.length < 2) {
      return { correlationMatrix: [], mills: [] };
    }

    // Calculate Pearson correlation for each pair
    const calculateCorrelation = (arr1: number[], arr2: number[]): number => {
      const n = Math.min(arr1.length, arr2.length);
      if (n < 2) return 0;

      const mean1 = arr1.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
      const mean2 = arr2.slice(0, n).reduce((sum, v) => sum + v, 0) / n;

      let numerator = 0;
      let denom1 = 0;
      let denom2 = 0;

      for (let i = 0; i < n; i++) {
        const diff1 = arr1[i] - mean1;
        const diff2 = arr2[i] - mean2;
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
      }

      const denominator = Math.sqrt(denom1 * denom2);
      if (denominator === 0) return 0;
      return numerator / denominator;
    };

    const matrix: CorrelationCell[][] = [];

    for (let i = 0; i < mills.length; i++) {
      const row: CorrelationCell[] = [];
      for (let j = 0; j < mills.length; j++) {
        const mill1 = mills[i];
        const mill2 = mills[j];
        const correlation =
          i === j
            ? 1
            : calculateCorrelation(millsData[mill1], millsData[mill2]);

        const mill1Num = parseInt(mill1.replace(/\D/g, ""));
        const mill2Num = parseInt(mill2.replace(/\D/g, ""));

        row.push({
          mill1,
          mill2,
          correlation: isNaN(correlation) ? 0 : correlation,
          displayName1: millsNames[mill1Num - 1]?.bg || mill1,
          displayName2: millsNames[mill2Num - 1]?.bg || mill2,
        });
      }
      matrix.push(row);
    }

    return { correlationMatrix: matrix, mills };
  }, [millsData]);

  if (correlationMatrix.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Няма достатъчно данни за корелационен анализ
      </div>
    );
  }

  // Color scale: -1 (red) -> 0 (white) -> 1 (green)
  const getCorrelationColor = (corr: number): string => {
    if (corr >= 0) {
      // Positive: white to green
      const intensity = Math.round(corr * 200);
      return `rgb(${255 - intensity}, 255, ${255 - intensity})`;
    } else {
      // Negative: white to red
      const intensity = Math.round(Math.abs(corr) * 200);
      return `rgb(255, ${255 - intensity}, ${255 - intensity})`;
    }
  };

  const getTextColor = (corr: number): string => {
    return Math.abs(corr) > 0.6 ? "text-white" : "text-gray-800";
  };

  // Get display names for headers
  const displayNames = mills.map((mill) => {
    const millNum = parseInt(mill.replace(/\D/g, ""));
    return millsNames[millNum - 1]?.bg || mill;
  });

  return (
    <div className="h-full flex flex-col">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>

      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="w-20 p-1"></th>
                {displayNames.map((name, i) => (
                  <th
                    key={i}
                    className="p-1 text-xs font-medium text-gray-600 text-center"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      height: "80px",
                    }}
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlationMatrix.map((row, i) => (
                <tr key={i}>
                  <td className="p-1 text-xs font-medium text-gray-600 text-right pr-2">
                    {displayNames[i]}
                  </td>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`p-1 text-center text-xs font-medium border border-gray-200 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${getTextColor(
                        cell.correlation
                      )}`}
                      style={{
                        backgroundColor: getCorrelationColor(cell.correlation),
                        width: "40px",
                        height: "40px",
                      }}
                      title={`${cell.displayName1} ↔ ${
                        cell.displayName2
                      }: ${cell.correlation.toFixed(3)}`}
                    >
                      {i === j ? "1.00" : cell.correlation.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Color scale legend */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-600">
        <span>-1.0</span>
        <div className="flex h-4 w-48 rounded overflow-hidden">
          <div className="flex-1 bg-gradient-to-r from-red-400 via-white to-green-400" />
        </div>
        <span>+1.0</span>
      </div>
      <div className="text-center text-xs text-gray-500 mt-1">
        Отрицателна ← Корелация → Положителна
      </div>
    </div>
  );
};
