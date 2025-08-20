"use client"

interface VerticalGaugeProps {
  value: number
  min: number
  max: number
  label: string
  color: string
  unit?: string
}

export function VerticalGauge({ value, min, max, label, color, unit }: VerticalGaugeProps) {
  const percentage = ((value - min) / (max - min)) * 100
  const clampedPercentage = Math.max(0, Math.min(100, percentage))
  
  // Determine the color class based on the color prop
  const getColorClass = () => {
    switch(color) {
      case 'blue': return 'bg-blue-600'
      case 'green': return 'bg-green-600'
      case 'red': return 'bg-red-600'
      case 'yellow': return 'bg-yellow-600'
      case 'amber': return 'bg-amber-500'
      case 'purple': return 'bg-purple-600'
      case 'orange': return 'bg-orange-500'
      default: return 'bg-blue-600'
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-8 h-60 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`absolute bottom-0 left-0 right-0 ${getColorClass()} rounded-full transition-all duration-300 ease-out`}
          style={{ height: `${clampedPercentage}%` }}
        />
        
        {/* Gauge markings */}
        <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col justify-between py-2">
          <div className="w-full border-t border-slate-400 dark:border-slate-500 opacity-50" />
          <div className="w-full border-t border-slate-400 dark:border-slate-500 opacity-50" />
          <div className="w-full border-t border-slate-400 dark:border-slate-500 opacity-50" />
          <div className="w-full border-t border-slate-400 dark:border-slate-500 opacity-50" />
          <div className="w-full border-t border-slate-400 dark:border-slate-500 opacity-50" />
        </div>
      </div>
      
      <div className="mt-2 flex flex-col items-center">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {max}{unit}
        </span>
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {min}{unit}
        </span>
      </div>
    </div>
  )
}
