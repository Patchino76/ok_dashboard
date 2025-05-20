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
        <p className="text-muted-foreground">Няма достатъчно данни</p>
      </div>
    )
  }

  // Create simple histogram buckets
  const min = Math.min(...data)
  const max = Math.max(...data)
  
  // If all values are the same
  if (min === max) {
    const singleBucketData = [{ name: `${min}`, value: data.length }]
    
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={singleBucketData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill={color} name="Брой записи" />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  
  // Calculate optimal number of bins based on sample size (Sturges' formula)
  // Other options are Freedman-Diaconis or Scott's rule, but Sturges is simple and works well for most cases
  const optimalBucketCount = Math.ceil(Math.log2(data.length) + 1)
  
  // Use at least 8 buckets for small datasets, but more for larger ones
  const bucketCount = Math.max(8, Math.min(15, optimalBucketCount))
  
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
    return {
      name: `${bucketStart.toFixed(0)}`,
      value: count
    }
  })
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 20
        }}
        barSize={30}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis allowDecimals={false} />
        <Tooltip
          formatter={(value) => [`${value}`, 'Брой записи']} 
        />
        <Legend verticalAlign="top" height={36} />
        <Bar
          dataKey="value"
          fill={color}
          name="Брой записи"
        />
        {mean !== undefined && (
          <ReferenceLine y={0} x={0} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
