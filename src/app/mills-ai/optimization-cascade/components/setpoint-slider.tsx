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
      {/* Simplified slim track */}
      <div
        ref={containerRef}
        className="relative w-3 bg-purple-100 dark:bg-purple-900/50 rounded-full"
        style={{ height }}
      >
        {/* Active range fill from bottom */}
        <div
          className="absolute left-0 right-0 bottom-0 bg-purple-400 rounded-full opacity-50"
          style={{ height: `${position}%` }}
        />

        {/* Setpoint marker - simple circle */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 cursor-ns-resize transition-transform ${
            isDragging ? "scale-125" : "hover:scale-110"
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
          <div className="w-5 h-5 rounded-full bg-purple-500 border-2 border-white shadow-md flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">
              {Math.round(value)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
