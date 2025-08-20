"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface ProcessData {
  timestamp: number
  pv: number
  sp: number
  aiSp: number
}

interface ProcessTrendChartProps {
  data: ProcessData[]
}

export function ProcessTrendChart({ data }: ProcessTrendChartProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatTime} 
            stroke="#6b7280" 
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
          <Tooltip 
            labelFormatter={formatTime}
            contentStyle={{ background: '#1f2937', borderColor: '#374151', color: '#e5e7eb' }}
            itemStyle={{ color: '#e5e7eb' }}
          />
          <Line 
            type="monotone" 
            dataKey="pv" 
            name="Process Value" 
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={false} 
            animationDuration={300}
          />
          <Line 
            type="monotone" 
            dataKey="sp" 
            name="Setpoint" 
            stroke="#10b981" 
            strokeWidth={2} 
            dot={false} 
            strokeDasharray="3 3"
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
