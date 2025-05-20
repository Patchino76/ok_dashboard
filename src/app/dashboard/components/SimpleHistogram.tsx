'use client'

import React from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

interface HistogramProps {
  data: number[]
  color: string
  mean?: number
}

/**
 * A simple histogram component that just works
 */
export function SimpleHistogram({ data, color, mean }: HistogramProps) {
  // No data case
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Няма данни за показване</p>
      </div>
    )
  }

  // Create simple histogram buckets
  const min = Math.min(...data)
  const max = Math.max(...data)
  
  // If all values are the same
  if (min === max) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground mb-2">Всички стойности са еднакви: {min}</p>
        <div className="w-1/2 h-24 bg-blue-100 border border-blue-300 rounded flex items-center justify-center">
          <span className="font-medium">{min}</span>
        </div>
      </div>
    )
  }
  
  // Calculate number of bins as a ratio of the sample size - Square root choice is another common rule
  // This provides more bins for larger datasets while staying reasonable for small ones
  const sqrtRule = Math.ceil(Math.sqrt(data.length))
  
  // Sturges' formula as a backup
  const sturgesRule = Math.ceil(Math.log2(data.length) + 1)
  
  // Use whichever gives more bins, with a minimum of 10 and maximum of 25
  const bucketCount = Math.max(10, Math.min(25, Math.max(sqrtRule, sturgesRule)))
  
  const range = max - min
  const bucketSize = range / bucketCount
  
  const buckets = Array(bucketCount).fill(0)
  
  // Fill buckets
  data.forEach(val => {
    // Handle edge case of max value
    if (val === max) {
      buckets[bucketCount - 1]++
      return
    }
    
    const bucketIndex = Math.floor((val - min) / bucketSize)
    if (bucketIndex >= 0 && bucketIndex < bucketCount) {
      buckets[bucketIndex]++
    }
  })
  
  // Format data for chart
  const chartData = buckets.map((count, i) => {
    const bucketStart = min + i * bucketSize
    const bucketEnd = min + (i + 1) * bucketSize
    
    // Format label based on index and bucket count to reduce density
    let label = `${bucketStart.toFixed(0)}`
    
    // For many buckets on small screens, only show label for some buckets
    if (bucketCount > 12) {
      // Show roughly 8-10 labels by using a step based on bucket count
      const step = Math.ceil(bucketCount / 8)
      if (i % step !== 0 && i !== bucketCount - 1) {
        label = '' // Empty label for intermediate buckets
      }
    }
    
    return {
      name: label,
      fullValue: bucketStart.toFixed(0), // Store full value for tooltip
      value: count
    }
  })
  
  // Calculate mean for reference (used for other statistics but not displayed on chart)
  const meanValue = mean || data.reduce((sum, val) => sum + val, 0) / data.length
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 10,
          bottom: 20
        }}
        barSize={30}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="name"
          fontSize={9}
          angle={-45}
          textAnchor="end"
          height={60}
          // On small screens, skip some labels to prevent overlapping
          // interval='preserveStartEnd' shows the first and last label and skips some in between
          // 0 would show all labels (too dense on mobile), 1 would show every other label
          interval="preserveStartEnd"
          // Allow dynamic ticks to intelligently pick how many labels to show
          allowDataOverflow={true}
          tickFormatter={(value) => value}
        />
        <YAxis 
          allowDecimals={false}
          tickFormatter={(value) => value > 999 ? `${(value/1000).toFixed(1)}k` : value}
          fontSize={9}
        />
        <Tooltip 
          formatter={(value, name, props) => [
            `${value} записа`, 
            'Брой'
          ]}
          labelFormatter={(label, props) => {
            // Use the full value for the tooltip label if available
            const item = props && props.length > 0 ? props[0].payload : null
            return item?.fullValue || label
          }}
        />
        <Bar dataKey="value" fill={color} name="Брой записи" />
      </BarChart>
    </ResponsiveContainer>
  )
}
