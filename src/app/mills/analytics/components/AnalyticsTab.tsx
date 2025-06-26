"use client";
import React from "react";

interface AnalyticsTabProps {
  parameter: string;
  timeRange: string;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ parameter, timeRange }) => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-6">Аналитика</h2>
      <p className="text-muted-foreground">
        Тук ще се визуализират разширени анализи, включващи:
      </p>
      <ul className="list-disc pl-6 mt-2 mb-6 space-y-2">
        <li>Прогнозни модели за бъдещи стойности</li>
        <li>Анализ на аномалии и отклонения</li>
        <li>Сравнение на ефективността между мелниците</li>
        <li>Оптимизационен анализ</li>
      </ul>
      <div className="flex items-center justify-center h-80 border border-dashed rounded-lg">
        <p className="text-center text-muted-foreground">
          Разширен аналитичен модул ще бъде внедрен скоро
        </p>
      </div>
    </div>
  );
};
