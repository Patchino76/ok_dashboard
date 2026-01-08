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

      // Round to step - NO clamping, allow values beyond min/max
      const steppedValue = Math.round(newValue / step) * step;

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
  // Clamp visual position to 0-100% so handle stays within track
  const positionRaw = ((value - min) / (max - min)) * 100;
  const position = Math.max(0, Math.min(100, positionRaw));

  return (
    <div className="flex justify-center h-full" style={{ width: "28px" }}>
      {/* Slim track - centered */}
      <div
        ref={containerRef}
        className="relative w-2 bg-purple-200 dark:bg-purple-900/50 rounded-full"
        style={{ height }}
      >
        {/* Active range fill from bottom */}
        <div
          className="absolute left-0 right-0 bottom-0 bg-purple-400 rounded-full opacity-50"
          style={{ height: `${position}%` }}
        />

        {/* Setpoint marker - pill shape for larger numbers */}
        <div
          className={`absolute left-1/2 cursor-ns-resize transition-transform ${
            isDragging ? "scale-110" : "hover:scale-105"
          }`}
          style={{
            bottom: `${position}%`,
            transform: "translate(-50%, 50%)",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          title={`SP: ${Math.round(value)}`}
        >
          <div
            className="px-1 rounded-sm bg-purple-500 border border-white shadow-sm"
            style={{ height: "14px", display: "flex", alignItems: "center" }}
          >
            <span className="text-[8px] font-semibold text-white whitespace-nowrap leading-none">
              {Math.round(value)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
