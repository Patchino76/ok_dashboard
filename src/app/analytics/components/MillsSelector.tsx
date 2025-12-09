"use client";

import React from "react";
import { useMillSelectionStore } from "@/lib/store/millSelectionStore";
import { millsNames } from "@/lib/tags/mills-tags";

// Shared helpers
const millColors = [
  "#4f46e5", // Indigo
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#14b8a6", // Teal
  "#6366f1", // Indigo alt
  "#84cc16", // Lime
  "#06b6d4", // Cyan
  "#d946ef", // Fuchsia
];

interface MillsSelectorProps {
  /** Array of mill identifiers (e.g. ["MILL_01", "MILL_02"] or ["1", "2"]) */
  mills: string[];
}

function getMillNumber(millName: string): number | null {
  // Try to extract numeric part from common formats: MILL_01, 01, 1, etc.
  const stripped = millName.replace("MILL_", "");
  const numeric = stripped.replace(/^0+/, "") || stripped.replace(/\D/g, "");
  const n = parseInt(numeric, 10);
  return Number.isNaN(n) ? null : n;
}

function getMillDisplayLabel(millName: string): string {
  const n = getMillNumber(millName);
  if (!n) return millName;

  const fromConfig = millsNames[n - 1]?.bg;
  if (fromConfig) return fromConfig;

  // Fallback to short MA label
  return `МА ${String(n).padStart(2, "0")}`;
}

// Horizontal selector – for wide layouts (e.g. top of analytics cards)
export const HorizontalMillsSelector: React.FC<MillsSelectorProps> = ({
  mills,
}) => {
  const { selectedMills, allSelected, toggleMill, toggleAllMills } =
    useMillSelectionStore();

  if (!mills.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={toggleAllMills}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            allSelected
              ? "bg-blue-500 text-white border-blue-500 shadow-sm"
              : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
          }`}
        >
          Всички
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {mills.map((millName, index) => {
          const isSelected = !!selectedMills[millName];
          const millColor = millColors[index % millColors.length];
          const label = getMillDisplayLabel(millName);

          return (
            <button
              key={`h-mill-${millName}-${index}`}
              type="button"
              onClick={() => toggleMill(millName)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs md:text-sm transition-colors shadow-sm ${
                isSelected
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
              }`}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  backgroundColor: millColor,
                  width: 8,
                  height: 8,
                }}
              />
              <span className="font-medium whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Vertical selector – for sidebars in comparison and trends tabs
export const VerticalMillsSelector: React.FC<MillsSelectorProps> = ({
  mills,
}) => {
  const { selectedMills, allSelected, toggleMill, toggleAllMills } =
    useMillSelectionStore();

  if (!mills.length) return null;

  return (
    <div className="w-32 flex flex-col gap-2">
      {/* Header with Select All toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">Мелници</span>
        <button
          type="button"
          onClick={toggleAllMills}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-full border ${
            allSelected
              ? "bg-blue-500 text-white border-blue-500 shadow-sm"
              : "bg-white text-blue-600 border-blue-500 hover:bg-blue-50"
          }`}
        >
          Всички
        </button>
      </div>

      {/* Mill list */}
      <div className="flex flex-col gap-1.5 overflow-y-auto">
        {mills.map((millName, index) => {
          const isSelected = !!selectedMills[millName];
          const millColor = millColors[index % millColors.length];
          const label = getMillDisplayLabel(millName);

          return (
            <div key={`v-mill-${millName}-${index}`} className="relative">
              <button
                type="button"
                onClick={() => toggleMill(millName)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: millColor }}
                  />
                  <span className="truncate">{label}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleMill(millName);
                }}
                className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded border text-[9px] ${
                  isSelected
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-300 text-transparent"
                }`}
                aria-label="Добави към множествен избор"
              >
                ✓
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
