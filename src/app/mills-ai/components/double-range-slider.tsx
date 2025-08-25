"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"

interface DoubleRangeSliderProps {
  min: number
  max: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  step?: number
  className?: string
  disabled?: boolean
}

export function DoubleRangeSlider({ min, max, value, onChange, step = 0.1, className = "", disabled = false }: DoubleRangeSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<"lo" | "hi" | null>(null)

  const getPercentage = (val: number) => ((val - min) / (max - min)) * 100

  const handleMouseDown = (type: "lo" | "hi") => (e: React.MouseEvent) => {
    if (disabled) return
    e.preventDefault()
    setIsDragging(type)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !sliderRef.current) return

    const rect = sliderRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const newValue = min + (percentage / 100) * (max - min)
    const steppedValue = Math.round(newValue / step) * step

    if (isDragging === "lo") {
      const newLo = Math.max(min, Math.min(steppedValue, value[1] - step))
      onChange([newLo, value[1]])
    } else if (isDragging === "hi") {
      const newHi = Math.min(max, Math.max(steppedValue, value[0] + step))
      onChange([value[0], newHi])
    }
  }

  const handleMouseUp = () => {
    setIsDragging(null)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, value, min, max, step])

  const loPercentage = getPercentage(value[0])
  const hiPercentage = getPercentage(value[1])

  return (
    <div className={`relative ${className}`}>
      <div className="flex justify-between mb-2 text-xs text-gray-600">
        <span>Lo: {value[0].toFixed(2)}</span>
        <span>Hi: {value[1].toFixed(2)}</span>
      </div>

      <div ref={sliderRef} className={`relative h-2 bg-gray-200 rounded-full ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        {/* Active range */}
        <div
          className="absolute h-2 bg-gray-800 rounded-full"
          style={{
            left: `${loPercentage}%`,
            width: `${hiPercentage - loPercentage}%`,
          }}
        />

        <div
          className="absolute w-4 h-4 bg-white border-2 border-gray-800 rounded-full cursor-pointer transform -translate-y-1 -translate-x-2 hover:scale-110 transition-transform"
          style={{ left: `${loPercentage}%` }}
          onMouseDown={handleMouseDown("lo")}
        />

        {/* Hi handle (right side) */}
        <div
          className="absolute w-4 h-4 bg-white border-2 border-gray-800 rounded-full cursor-pointer transform -translate-y-1 -translate-x-2 hover:scale-110 transition-transform"
          style={{ left: `${hiPercentage}%` }}
          onMouseDown={handleMouseDown("hi")}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Min: {min.toFixed(2)}</span>
        <span>Max: {max.toFixed(2)}</span>
      </div>
    </div>
  )
}
