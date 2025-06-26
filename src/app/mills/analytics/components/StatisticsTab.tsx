"use client";
import React from "react";

interface StatisticsTabProps {
  parameter: string;
  timeRange: string;
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({ parameter, timeRange }) => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-6">Статистика</h2>
      <p className="text-muted-foreground">
        Тук ще се визуализира детайлна статистика за избрания параметър.
        Включително: статистически разпределения, корелации с други параметри и исторически тенденции.
      </p>
      <div className="flex items-center justify-center h-80 border border-dashed rounded-lg">
        <p className="text-center text-muted-foreground">
          Статистически анализ ще бъде внедрен скоро
        </p>
      </div>
    </div>
  );
};
