"use client";

import { useState, useRef, useEffect } from "react";

interface OptimizationBoundsSliderProps {
  /** Current low bound value */
  loValue: number;
  /** Current high bound value */
  hiValue: number;
  /** Minimum allowed value (chart domain min) */
  min: number;
  /** Maximum allowed value (chart domain max) */
  max: number;
  /** Callback when lo bound changes */
  onLoChange: (value: number) => void;
  /** Callback when hi bound changes */
  onHiChange: (value: number) => void;
  /** Unit symbol for display */
  unit?: string;
  /** Height to match (e.g., "85%") */
  height?: string;
}

export function OptimizationBoundsSlider({
  loValue,
  hiValue,
  min,
  max,
  onLoChange,
  onHiChange,
  unit = "",
  height = "85%",
}: OptimizationBoundsSliderProps) {
  const [isDraggingLo, setIsDraggingLo] = useState(false);
  const [isDraggingHi, setIsDraggingHi] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || (!isDraggingLo && !isDraggingHi)) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerHeight = rect.height;
      const mouseY = e.clientY - rect.top;

      // Calculate percentage (inverted for vertical, 0 at bottom)
      const percentage = 1 - mouseY / containerHeight;

      // Map to value range
      const value = min + percentage * (max - min);

      // Clamp to bounds
      const clampedValue = Math.max(min, Math.min(max, value));

      if (isDraggingLo) {
        onLoChange(Math.min(clampedValue, hiValue - 0.1));
      } else if (isDraggingHi) {
        onHiChange(Math.max(clampedValue, loValue + 0.1));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLo(false);
      setIsDraggingHi(false);
    };

    if (isDraggingLo || isDraggingHi) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDraggingLo, isDraggingHi, min, max, loValue, hiValue, onLoChange, onHiChange]);

  // Calculate positions (0% = bottom, 100% = top)
  const loPosition = ((loValue - min) / (max - min)) * 100;
  const hiPosition = ((hiValue - min) / (max - min)) * 100;

  return (
    <div className="flex items-start h-full">
      {/* Slider track and markers container - no Y-axis */}
      <div
        ref={containerRef}
        className="relative w-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700 rounded-lg shadow-inner border border-slate-200 dark:border-slate-600"
        style={{ height }}
      >
        {/* Range fill between lo and hi */}
        <div
          className="absolute inset-x-1.5 bg-gradient-to-b from-blue-400/30 via-purple-400/30 to-red-400/30 rounded-lg"
          style={{
            bottom: `${loPosition}%`,
            height: `${hiPosition - loPosition}%`,
          }}
        />

        {/* Hi bound marker (red) - larger with integrated value */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 cursor-ns-resize group transition-all ${
            isDraggingHi ? "scale-110" : "hover:scale-105"
          }`}
          style={{
            bottom: `${hiPosition}%`,
            transform: "translate(-50%, 50%)",
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingHi(true);
          }}
        >
          {/* Larger marker with integrated value */}
          <div className="px-2 py-1 rounded-md bg-gradient-to-br from-red-400 to-red-600 shadow-lg border-2 border-white dark:border-slate-900">
            <div className="text-white text-[10px] font-bold whitespace-nowrap">
              {Math.round(hiValue)}
            </div>
          </div>
        </div>

        {/* Lo bound marker (blue) - larger with integrated value */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 cursor-ns-resize group transition-all ${
            isDraggingLo ? "scale-110" : "hover:scale-105"
          }`}
          style={{
            bottom: `${loPosition}%`,
            transform: "translate(-50%, 50%)",
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingLo(true);
          }}
        >
          {/* Larger marker with integrated value */}
          <div className="px-2 py-1 rounded-md bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg border-2 border-white dark:border-slate-900">
            <div className="text-white text-[10px] font-bold whitespace-nowrap">
              {Math.round(loValue)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
