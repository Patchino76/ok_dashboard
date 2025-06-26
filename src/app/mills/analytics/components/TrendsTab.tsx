"use client";
import React from "react";

interface TrendsTabProps {
  parameter: string;
  timeRange: string;
}

export const TrendsTab: React.FC<TrendsTabProps> = ({ parameter, timeRange }) => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-6">Тенденции</h2>
      <p className="text-muted-foreground">
        Тук ще се визуализират тенденции за избраният параметър по време.
        В този таб ще бъде добавена функционалност за анализиране на промените на параметрите с течение на времето.
      </p>
      <div className="flex items-center justify-center h-80 border border-dashed rounded-lg">
        <p className="text-center text-muted-foreground">
          Тренд визуализация ще бъде внедрена скоро
        </p>
      </div>
    </div>
  );
};
