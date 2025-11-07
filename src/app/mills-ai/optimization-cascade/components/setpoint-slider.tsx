"use client";

import { useState, useRef, useEffect } from "react";

interface SetpointSliderProps {
  /** Current setpoint value */
  value: number;
  /** Minimum allowed value */
  min: number;
  /** Maximum allowed value */
  max: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Unit symbol for display */
  unit?: string;
  /** Height to match (e.g., "100%") */
  height?: string;
  /** Step size for value changes */
  step?: number;
}

export function SetpointSlider({
  value,
  min,
  max,
  onChange,
  unit = "",
  height = "100%",
  step = 0.1,
}: SetpointSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !isDragging) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerHeight = rect.height;
      const mouseY = e.clientY - rect.top;

      // Calculate percentage (inverted for vertical, 0 at bottom)
      const percentage = 1 - mouseY / containerHeight;

      // Map to value range
      const newValue = min + percentage * (max - min);

      // Clamp to bounds and round to step
      const clampedValue = Math.max(min, Math.min(max, newValue));
      const steppedValue = Math.round(clampedValue / step) * step;

      onChange(steppedValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, min, max, step, onChange]);

  // Calculate position (0% = bottom, 100% = top)
  const position = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex items-start h-full">
      {/* Slider track and marker container - no Y-axis */}
      <div
        ref={containerRef}
        className="relative w-8 bg-gradient-to-b from-purple-100 via-purple-50 to-purple-100 dark:from-purple-900 dark:via-purple-950 dark:to-purple-900 rounded-lg shadow-inner border border-purple-200 dark:border-purple-700"
        style={{ height }}
      >
        {/* Active range fill from bottom to current value */}
        <div
          className="absolute inset-x-1.5 bottom-0 bg-gradient-to-b from-purple-500/40 to-purple-400/40 rounded-lg"
          style={{
            height: `${position}%`,
          }}
        />

        {/* Setpoint marker (purple) - larger with integrated value */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 cursor-ns-resize group transition-all ${
            isDragging ? "scale-110" : "hover:scale-105"
          }`}
          style={{
            bottom: `${position}%`,
            transform: "translate(-50%, 50%)",
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDragging(true);
          }}
        >
          {/* Larger marker with integrated value */}
          <div className="px-2 py-1 rounded-md bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg border-2 border-white dark:border-slate-900">
            <div className="text-white text-[10px] font-bold whitespace-nowrap">
              {Math.round(value)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
