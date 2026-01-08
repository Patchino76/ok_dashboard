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

      // Map to value range - NO clamping, allow values beyond min/max
      const value = min + percentage * (max - min);

      if (isDraggingLo) {
        // Only ensure lo stays below hi
        onLoChange(Math.min(value, hiValue - 0.1));
      } else if (isDraggingHi) {
        // Only ensure hi stays above lo
        onHiChange(Math.max(value, loValue + 0.1));
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
  }, [
    isDraggingLo,
    isDraggingHi,
    min,
    max,
    loValue,
    hiValue,
    onLoChange,
    onHiChange,
  ]);

  // Calculate positions (0% = bottom, 100% = top)
  // Clamp visual position to 0-100% so handles stay within track
  const loPositionRaw = ((loValue - min) / (max - min)) * 100;
  const hiPositionRaw = ((hiValue - min) / (max - min)) * 100;
  const loPosition = Math.max(0, Math.min(100, loPositionRaw));
  const hiPosition = Math.max(0, Math.min(100, hiPositionRaw));

  return (
    <div className="flex justify-center h-full" style={{ width: "28px" }}>
      {/* Slim track - centered */}
      <div
        ref={containerRef}
        className="relative w-2 bg-slate-200 dark:bg-slate-700 rounded-full"
        style={{ height }}
      >
        {/* Range fill between lo and hi */}
        <div
          className="absolute left-0 right-0 bg-gradient-to-b from-red-400 via-amber-300 to-blue-400 rounded-full opacity-60"
          style={{
            bottom: `${loPosition}%`,
            height: `${hiPosition - loPosition}%`,
          }}
        />

        {/* Hi bound marker - pill shape for larger numbers */}
        <div
          className={`absolute left-1/2 cursor-ns-resize transition-transform ${
            isDraggingHi ? "scale-110" : "hover:scale-105"
          }`}
          style={{
            bottom: `${hiPosition}%`,
            transform: "translate(-50%, 50%)",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDraggingHi(true);
          }}
          title={`Макс: ${Math.round(hiValue)}`}
        >
          <div
            className="px-1 rounded-sm bg-red-500 border border-white shadow-sm"
            style={{ height: "14px", display: "flex", alignItems: "center" }}
          >
            <span className="text-[8px] font-semibold text-white whitespace-nowrap leading-none">
              {Math.round(hiValue)}
            </span>
          </div>
        </div>

        {/* Lo bound marker - pill shape for larger numbers */}
        <div
          className={`absolute left-1/2 cursor-ns-resize transition-transform ${
            isDraggingLo ? "scale-110" : "hover:scale-105"
          }`}
          style={{
            bottom: `${loPosition}%`,
            transform: "translate(-50%, 50%)",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDraggingLo(true);
          }}
          title={`Мін: ${Math.round(loValue)}`}
        >
          <div
            className="px-1 rounded-sm bg-blue-500 border border-white shadow-sm"
            style={{ height: "14px", display: "flex", alignItems: "center" }}
          >
            <span className="text-[8px] font-semibold text-white whitespace-nowrap leading-none">
              {Math.round(loValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
