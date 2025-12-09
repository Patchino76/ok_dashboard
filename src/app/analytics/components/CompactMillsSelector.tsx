"use client";
import React from "react";
import { useMillSelectionStore } from "@/lib/store/millSelectionStore";
import { millColors } from "./MillsSelector";

// Array of colors for mill indicators

interface CompactMillsSelectorProps {
  /** Array of mill names (e.g., ["MILL_01", "MILL_02", ...] or ["1", "2", ...]) */
  mills: string[];
}

export const CompactMillsSelector: React.FC<CompactMillsSelectorProps> = ({
  mills,
}) => {
  const { selectedMills, allSelected, toggleMill, toggleAllMills } =
    useMillSelectionStore();

  return (
    <div className="w-24 flex flex-col">
      {/* Header with Select All toggle */}
      <div
        className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 cursor-pointer hover:bg-gray-50 rounded px-1"
        onClick={toggleAllMills}
      >
        <span className="text-xs font-medium text-gray-500">Всички</span>
        <div
          className={`relative inline-flex items-center h-4 rounded-full w-7 transition-colors duration-200 ${
            allSelected ? "bg-blue-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block w-3 h-3 transform rounded-full bg-white shadow transition duration-200 ${
              allSelected ? "translate-x-3.5" : "translate-x-0.5"
            }`}
          />
        </div>
      </div>

      {/* Compact mill list */}
      <div className="flex flex-col space-y-1.5 overflow-y-auto">
        {mills.map((millName, index) => {
          const isSelected = !!selectedMills[millName];
          const millColor = millColors[index % millColors.length];

          // Extract mill number from various formats (MILL_01, 01, 1, etc.)
          const millNumber =
            millName.replace("MILL_", "").replace(/^0+/, "") ||
            millName.replace(/\D/g, "");
          const displayName = `MA ${millNumber}`;

          return (
            <div
              key={`mill-${index}-${millName}`}
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
              onClick={() => toggleMill(millName)}
            >
              <div className="flex items-center">
                <span
                  className="inline-block mr-1.5 rounded-sm"
                  style={{
                    backgroundColor: millColor,
                    width: "8px",
                    height: "8px",
                  }}
                />
                <span className="text-xs font-medium text-gray-700">
                  {displayName}
                </span>
              </div>
              <div
                className={`relative inline-flex items-center h-4 rounded-full w-7 transition-colors duration-200 ${
                  isSelected ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block w-3 h-3 transform rounded-full bg-white shadow transition duration-200 ${
                    isSelected ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
